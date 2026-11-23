// Core filesystem store for Harness Hub:
// - Lossless parser & writer for .specs/tasks/task-*.md (100% compatible with scripts/validate-task.mjs)
// - Atomic persistence for .specs/hub/board.json
// - Atomic kernel locks (.specs/hub/locks/<id>.lock) via fs.openSync(..., 'wx') + stale-lock recovery
// - Read-only readers for AGENTS.md / .claude/agents/*.md, CLAUDE.md gates + logs, and incidents.jsonl
// Zero dependencies — Node.js v24 native ESM.

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  watch as fsWatch,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import {
  computeQueue,
  DESTINATIONS,
  findFileOverlaps,
  formatStatusLine,
  getRequiredReviewers,
  normalizeFilePath,
  parseStatusLine,
  PLANNING_LANES,
  PRIORITIES,
  PRIORITY_RANK,
  READ_ONLY_AGENTS,
  statusToDefaultLane,
  TIERS,
  TYPES,
  validateReviewerAssignment,
  validateTransition,
} from './state-machine.mjs';

export const TASK_ID_RE = /^[a-z0-9][a-z0-9-]{0,120}$/;

const VALIDATOR_STATUS_RE =
  /^(PLANNING|IN_PROGRESS|IN_REVIEW|READY_TO_COMMIT|COMMITTED|SHIPPED|BLOCKED: .+|BLOCKED\((PLANNING|IN_PROGRESS|IN_REVIEW|READY_TO_COMMIT)\): .+|CANCELLED|SUPERSEDED: .+)$/;

const VAGUE_AC_RE =
  /\b(fast|quick(ly)?|slow|scalable|secure|robust|intuitive|user-friendly|easy|simple|seamless|efficient|reliable|properly|correctly|appropriate(ly)?|good|nice|clean)\b/i;

const ALLOWED_THEMES = new Set(['dark', 'light']);
const ALLOWED_BOARD_VIEW_MODES = new Set(['dual', 'unified']);

const DEFAULT_CONFIG = Object.freeze({
  autoRunOnInProgress: true,
  maxConcurrentRuns: 2,
  defaultEngine: 'mock',
  defaultMode: 'impl',
  theme: 'dark',
  boardViewMode: 'dual',
});

export class StoreError extends Error {
  constructor(code, message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
  }
}

/**
 * Validates a task ID against strict slug rules and path traversal attempts.
 */
export function validateTaskId(id) {
  if (typeof id !== 'string' || !id) {
    throw new StoreError('INVALID_TASK_ID', 'ID de tarefa inválido ou vazio', 400);
  }
  if (
    id.includes('/') ||
    id.includes('\\') ||
    id.includes('..') ||
    id.includes('\0') ||
    !TASK_ID_RE.test(id)
  ) {
    throw new StoreError(
      'INVALID_TASK_ID',
      `ID de tarefa inválido: "${id}". Use apenas letras minúsculas, números e hífens.`,
      400,
    );
  }
  return id;
}

/**
 * Converts a title into a safe ASCII kebab-case slug.
 */
export function slugify(text, maxLen = 60) {
  const slug = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '');
  return slug || 'untitled';
}

/**
 * Resolves a path strictly inside `baseDir`, throwing on any traversal attempt.
 */
function safeJoin(baseDir, fileName) {
  const absBase = resolve(baseDir);
  const absTarget = resolve(absBase, fileName);
  if (absTarget !== absBase && !absTarget.startsWith(absBase + sep)) {
    throw new StoreError('PATH_TRAVERSAL', 'Acesso fora do diretório permitido bloqueado', 400);
  }
  return absTarget;
}

/**
 * Atomic file write (write temp file in same directory + rename).
 * Includes a bounded retry for transient Windows NTFS rename locks.
 */
export function atomicWriteFile(targetPath, content) {
  const dir = dirname(targetPath);
  mkdirSync(dir, { recursive: true });
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpPath = `${targetPath}.tmp-${suffix}`;
  writeFileSync(tmpPath, content, 'utf8');

  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      renameSync(tmpPath, targetPath);
      return;
    } catch (err) {
      lastErr = err;
      if (err.code !== 'EPERM' && err.code !== 'EBUSY') break;
    }
  }
  try {
    unlinkSync(tmpPath);
  } catch {
    // ignore cleanup error
  }
  throw lastErr;
}

/**
 * Checks whether a PID is currently alive.
 */
function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * Extracts a markdown section body (stripped of HTML comments), matching scripts/validate-task.mjs.
 */
function extractSection(text, title) {
  const m = text.match(
    new RegExp(`^## ${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'),
  );
  return m ? m[1].replace(/<!--[\s\S]*?-->/g, '').trim() : null;
}

/**
 * In-process mirror of scripts/validate-task.mjs for fast synchronous validation.
 */
export function validateTaskContent(rawText, filename = 'task-item.md') {
  const text = String(rawText || '').replace(/\r\n/g, '\n');
  const profile = /^task-(fix|hotfix)-/.test(basename(filename)) ? 'short' : 'full';
  const errors = [];
  const warnings = [];

  const status = (text.match(/^## Status:\s*(.+)$/m) || [])[1]?.trim();
  if (!status) errors.push('missing "## Status:" line');
  else if (!VALIDATOR_STATUS_RE.test(status)) {
    errors.push(`status "${status}" is not in the state machine`);
  }

  const required =
    profile === 'short'
      ? ['Problem', 'Acceptance criteria', 'Files']
      : ['Problem', 'Acceptance criteria', 'Out of scope', 'Approach', 'Files', 'Test scope'];

  for (const req of required) {
    const body = extractSection(text, req);
    if (body === null) errors.push(`missing section "## ${req}"`);
    else if (!body) errors.push(`section "## ${req}" is empty`);
    else if (/<[^>\n]{3,}>/.test(body)) {
      errors.push(`section "## ${req}" still has a template placeholder`);
    }
  }

  const acBody = extractSection(text, 'Acceptance criteria') ?? '';
  const acs = acBody.split('\n').filter((l) => /^- \[[ x]\]/.test(l));
  if (!acs.length) errors.push('no acceptance criteria (lines starting with "- [ ]")');

  for (const ac of acs) {
    const claim = ac.split('— evidence:')[0];
    const hit = claim.match(VAGUE_AC_RE);
    if (hit && !/\d/.test(claim)) {
      warnings.push(
        `AC is not testable as written ("${hit[0]}" without a measure): ${claim.trim().slice(0, 90)}`,
      );
    }
    if (/\b(TODO|TBD|\?\?\?)\b/.test(claim)) {
      errors.push(`AC has an unresolved marker: ${claim.trim().slice(0, 90)}`);
    }
  }

  const proof =
    extractSection(text, 'Proof') ??
    ((extractSection(text, 'Amplified brief') ?? '').match(/Proof[^:\n]*:\s*(.*)/) || [])[1]?.trim();
  if (profile === 'full' && (!proof || /^</.test(proof))) {
    errors.push(
      'no external oracle named — fix: name what proves the result besides us under "## Proof"',
    );
  }

  const files = (extractSection(text, 'Files') ?? '').split('\n').filter((l) => /^- /.test(l));
  if (!files.length) errors.push('"## Files" lists no files');

  const slices = (extractSection(text, 'Slices') ?? '')
    .split('\n')
    .filter((l) => /^\| *S\d+/.test(l));
  const seen = new Map();
  for (const line of slices) {
    const cells = line.split('|').map((c) => c.trim());
    for (const f of (cells[2] ?? '').split(/[,\s]+/).filter((x) => /[./]/.test(x))) {
      if (seen.has(f)) errors.push(`file ${f} is in two slices (${seen.get(f)} and ${cells[1]})`);
      else seen.set(f, cells[1]);
    }
  }

  if (['READY_TO_COMMIT', 'COMMITTED', 'SHIPPED'].includes(status)) {
    for (const ac of acs) {
      if (/^- \[ \]/.test(ac)) {
        errors.push(`status is ${status} but an AC is unchecked: ${ac.slice(6, 90)}`);
      } else if (!/— evidence:\s*\S/.test(ac)) {
        errors.push(`status is ${status} but an AC has no evidence: ${ac.slice(6, 90)}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    profile,
    errors,
    warnings,
  };
}

/**
 * Parses a task Markdown file into a structured task object.
 */
export function parseTaskMarkdown(rawText, { id = '', filePath = '', mtimeMs = 0 } = {}) {
  const text = String(rawText || '').replace(/\r\n/g, '\n');
  const titleMatch = text.match(/^#\s+Task:\s*(.+)$/m) || text.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : id || 'Sem título';

  const rawStatus = (text.match(/^## Status:\s*(.+)$/m) || [])[1]?.trim() || '';
  const parsedStatus = parseStatusLine(rawStatus);

  const source = extractSection(text, 'Source') ?? '';
  const proof =
    extractSection(text, 'Proof') ??
    ((extractSection(text, 'Amplified brief') ?? '').match(/Proof[^:\n]*:\s*(.*)/) || [])[1]?.trim() ??
    '';
  const problem = extractSection(text, 'Problem') ?? '';

  const acBody = extractSection(text, 'Acceptance criteria') ?? '';
  const acceptanceCriteria = [];
  let acIdx = 0;
  for (const line of acBody.split('\n')) {
    const m = line.match(/^- \[([ x])\]\s*(.*)$/);
    if (!m) continue;
    const done = m[1] === 'x';
    const rest = m[2];
    const parts = rest.split('— evidence:');
    const acText = parts[0].trim();
    const evidence = parts.length > 1 ? parts.slice(1).join('— evidence:').trim() : '';
    acceptanceCriteria.push({ index: acIdx++, done, text: acText, evidence });
  }

  const outOfScopeBody = extractSection(text, 'Out of scope') ?? '';
  const outOfScope = outOfScopeBody
    .split('\n')
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);

  const approach = extractSection(text, 'Approach') ?? '';

  const filesBody = extractSection(text, 'Files') ?? '';
  const files = filesBody
    .split('\n')
    .filter((l) => /^- /.test(l))
    .map(normalizeFilePath)
    .filter(Boolean);

  const slicesBody = extractSection(text, 'Slices') ?? '';
  const slices = slicesBody
    .split('\n')
    .filter((l) => /^\| *S\d+/.test(l))
    .map((line) => {
      const cells = line.split('|').map((c) => c.trim());
      return {
        id: cells[1] || '',
        scope: cells[2] || '',
        dependsOn: cells[3] || '',
        owner: cells[4] || '',
      };
    });

  const testScope = extractSection(text, 'Test scope') ?? '';
  const securityNotes = extractSection(text, 'Security notes') ?? '';
  const decisionsTaken = extractSection(text, 'Decisions taken') ?? '';
  const needsFromUser = extractSection(text, 'Needs from user') ?? '';

  const logBody = extractSection(text, 'Log') ?? '';
  const log = logBody
    .split('\n')
    .map((l) => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);

  const validation = validateTaskContent(text, filePath || `${id}.md`);

  return {
    id,
    filePath,
    title,
    status: parsedStatus.status,
    rawStatus,
    blockedFrom: parsedStatus.blockedFrom,
    blockedReason: parsedStatus.blockedReason,
    supersededBy: parsedStatus.supersededBy,
    valid: validation.valid,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    mtimeMs,
    source,
    proof,
    problem,
    acceptanceCriteria,
    outOfScope,
    approach,
    files,
    slices,
    testScope,
    securityNotes,
    decisionsTaken,
    needsFromUser,
    log,
  };
}

/**
 * Lossless update of the `## Status:` line.
 */
function replaceStatusLine(rawText, newStatusValue) {
  const eol = rawText.includes('\r\n') ? '\r\n' : '\n';
  const normalized = rawText.replace(/\r\n/g, '\n');
  let updated;
  if (/^## Status:\s*.*$/m.test(normalized)) {
    updated = normalized.replace(/^## Status:\s*.*$/m, `## Status: ${newStatusValue}`);
  } else {
    updated = normalized.replace(/^(# .*\n)/, `$1\n## Status: ${newStatusValue}\n`);
  }
  return eol === '\r\n' ? updated.replace(/\n/g, '\r\n') : updated;
}

/**
 * Lossless update of a specific `## <Heading>` section body while preserving leading HTML comments.
 */
function replaceSectionBody(rawText, heading, newBody) {
  const eol = rawText.includes('\r\n') ? '\r\n' : '\n';
  const normalized = rawText.replace(/\r\n/g, '\n');
  const re = new RegExp(`(^## ${heading}[^\\n]*\\n)([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm');
  const match = normalized.match(re);
  const cleanBody = String(newBody ?? '').trim();

  let updated;
  if (match) {
    const existingBody = match[2];
    const leadingComments = (existingBody.match(/^(?:\s*<!--[\s\S]*?-->\s*\n)*/) || [''])[0];
    const replacement = `${match[1]}${leadingComments}${cleanBody ? `${cleanBody}\n\n` : '\n'}`;
    updated = normalized.replace(re, replacement);
  } else {
    const sepNewline = normalized.endsWith('\n') ? '\n' : '\n\n';
    updated = `${normalized}${sepNewline}## ${heading}\n${cleanBody}\n`;
  }
  return eol === '\r\n' ? updated.replace(/\n/g, '\r\n') : updated;
}

/**
 * Lossless update of a single acceptance criterion line by index.
 */
function updateAcLineInMarkdown(rawText, acIndex, { done, evidence, text }) {
  const eol = rawText.includes('\r\n') ? '\r\n' : '\n';
  const normalized = rawText.replace(/\r\n/g, '\n');
  const re = /(^## Acceptance criteria[^\n]*\n)([\s\S]*?)(?=^## |$(?![\s\S]))/m;
  const match = normalized.match(re);
  if (!match) {
    throw new StoreError('AC_SECTION_MISSING', 'Seção "## Acceptance criteria" não encontrada', 422);
  }

  let currentIdx = 0;
  let found = false;
  const lines = match[2].split('\n').map((line) => {
    const m = line.match(/^- \[([ x])\]\s*(.*)$/);
    if (!m) return line;
    if (currentIdx++ !== acIndex) return line;
    found = true;
    const parts = m[2].split('— evidence:');
    const existingText = parts[0].trim();
    const existingEv = parts.length > 1 ? parts.slice(1).join('— evidence:').trim() : '';
    const nextDone = done !== undefined ? Boolean(done) : m[1] === 'x';
    const nextText = text !== undefined ? String(text).trim() : existingText;
    const nextEv = evidence !== undefined ? String(evidence).trim() : existingEv;
    return `- [${nextDone ? 'x' : ' '}] ${nextText} — evidence: ${nextEv}`;
  });

  if (!found) {
    throw new StoreError('AC_NOT_FOUND', `Critério de aceite #${acIndex} não encontrado`, 404);
  }

  const updated = normalized.replace(re, `${match[1]}${lines.join('\n')}`);
  return eol === '\r\n' ? updated.replace(/\n/g, '\r\n') : updated;
}

/**
 * Lossless append of a log entry under `## Log`.
 */
function appendLogLine(rawText, entry) {
  const eol = rawText.includes('\r\n') ? '\r\n' : '\n';
  const normalized = rawText.replace(/\r\n/g, '\n');
  const re = /(^## Log[^\n]*\n)([\s\S]*?)(?=^## |$(?![\s\S]))/m;
  const match = normalized.match(re);
  let updated;
  if (match) {
    const body = match[2].replace(/\s+$/, '');
    const nextBody = body ? `${body}\n- ${entry}\n` : `- ${entry}\n`;
    updated = normalized.replace(re, `${match[1]}${nextBody}`);
  } else {
    const tail = normalized.endsWith('\n') ? '\n' : '\n\n';
    updated = `${normalized}${tail}## Log\n- ${entry}\n`;
  }
  return eol === '\r\n' ? updated.replace(/\n/g, '\r\n') : updated;
}

/**
 * Builds a valid task markdown document that passes scripts/validate-task.mjs with 0 errors.
 */
function buildTaskMarkdown(input) {
  const title = String(input.title).trim();
  const source = String(input.source || '').trim() || 'Solicitação via Harness Hub';
  const proof = String(input.proof || '').trim() || 'node --test';
  const problem =
    String(input.problem || '').trim() ||
    `Registrar e entregar a demanda "${title}" com validação automatizada.`;

  const rawAcs = Array.isArray(input.acceptanceCriteria) ? input.acceptanceCriteria : [];
  const acLines =
    rawAcs.length > 0
      ? rawAcs.map((ac) => {
          if (typeof ac === 'string') {
            return `- [ ] ${ac.trim()} — evidence: `;
          }
          const mark = ac.done ? 'x' : ' ';
          const ev = ac.evidence ? String(ac.evidence).trim() : '';
          return `- [${mark}] ${String(ac.text || '').trim()} — evidence: ${ev}`;
        })
      : [`- [ ] Entrega "${title}" verificada com 0 erros no teste automatizado — evidence: `];

  const rawOut = Array.isArray(input.outOfScope) ? input.outOfScope : [];
  const outLines =
    rawOut.length > 0
      ? rawOut.map((o) => `- ${String(o).trim()}`)
      : ['- Alterações fora dos arquivos listados em Files'];

  const approach =
    String(input.approach || '').trim() ||
    'Executar implementação incremental nos arquivos declarados e validar com testes.';

  const rawFiles = Array.isArray(input.files) ? input.files : [];
  const fileLines =
    rawFiles.length > 0
      ? rawFiles.map((f) => {
          const clean = normalizeFilePath(String(f));
          return `- \`${clean || String(f).trim()}\``;
        })
      : ['- `hub/lib/store.mjs` — escopo inicial a refinar'];

  const testScope =
    String(input.testScope || '').trim() ||
    'Run: node --test\nDo not run: full suite (that is the @committer gate)';

  const securityNotes = String(input.securityNotes || '').trim() || 'none';
  const today = new Date().toISOString().slice(0, 10);
  const actor = input.actor || 'user';

  return [
    `# Task: ${title}`,
    '',
    '## Status: PLANNING',
    '<!-- PLANNING → IN_PROGRESS → IN_REVIEW → READY_TO_COMMIT → COMMITTED → SHIPPED | BLOCKED(<previous>): <reason> | CANCELLED | SUPERSEDED: <task file> -->',
    '',
    '## Source',
    source,
    '',
    '## Proof',
    proof,
    '',
    '## Problem',
    problem,
    '',
    '## Acceptance criteria',
    '<!-- Testable behaviours, not goals. Evidence is filled in during /build. -->',
    ...acLines,
    '',
    '## Out of scope',
    ...outLines,
    '',
    '## Approach',
    approach,
    '',
    '## Files',
    ...fileLines,
    '',
    '## Test scope',
    testScope,
    '',
    '## Security notes',
    securityNotes,
    '',
    '## Decisions taken',
    '<!-- Level B decisions made autonomously, one line each with reason -->',
    '',
    '## Needs from user',
    '<!-- Level C only: decisions, credentials, access, paid resources. Empty = proceed. -->',
    '',
    '## Log',
    `<!-- date — agent — what happened -->`,
    `- ${today} — ${actor} — tarefa criada`,
    '',
  ].join('\n');
}

/**
 * Factory for an isolated Harness Hub store bound to `rootDir`.
 */
export function createStore(rootDir) {
  const root = resolve(rootDir);
  const specsDir = join(root, '.specs');
  const tasksDir = join(specsDir, 'tasks');
  const hubDir = join(specsDir, 'hub');
  const locksDir = join(hubDir, 'locks');
  const boardPath = join(hubDir, 'board.json');
  const logsDir = join(specsDir, 'logs');
  const incidentsPath = join(specsDir, 'harness', 'incidents.jsonl');
  const agentsDir = join(root, '.claude', 'agents');

  // ---- board.json helpers ----
  function readBoard() {
    if (!existsSync(boardPath)) {
      return {
        version: 1,
        config: { ...DEFAULT_CONFIG },
        tasks: {},
        activity: [],
      };
    }
    try {
      const parsed = JSON.parse(readFileSync(boardPath, 'utf8'));
      return {
        version: parsed.version || 1,
        config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
        tasks: parsed.tasks && typeof parsed.tasks === 'object' ? parsed.tasks : {},
        activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      };
    } catch {
      return {
        version: 1,
        config: { ...DEFAULT_CONFIG },
        tasks: {},
        activity: [],
      };
    }
  }

  function writeBoard(board) {
    const normalized = {
      version: 1,
      config: { ...DEFAULT_CONFIG, ...(board.config || {}) },
      tasks: board.tasks || {},
      activity: (board.activity || []).slice(0, 200),
    };
    atomicWriteFile(boardPath, `${JSON.stringify(normalized, null, 2)}\n`);
    return normalized;
  }

  function pushActivity(board, { actor = 'user', engine = null, type, taskId = null, message }) {
    const evt = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ts: new Date().toISOString(),
      actor,
      engine,
      type,
      taskId,
      message,
    };
    board.activity = [evt, ...(board.activity || [])].slice(0, 200);
    return evt;
  }

  function recordActivity(event) {
    const board = readBoard();
    const evt = pushActivity(board, event);
    writeBoard(board);
    return evt;
  }

  function updateConfig(patch = {}) {
    const board = readBoard();
    if (patch.autoRunOnInProgress !== undefined) {
      if (typeof patch.autoRunOnInProgress !== 'boolean') {
        throw new StoreError('INVALID_CONFIG', 'autoRunOnInProgress deve ser boolean', 400);
      }
      board.config.autoRunOnInProgress = patch.autoRunOnInProgress;
    }
    if (patch.maxConcurrentRuns !== undefined) {
      const n = Number(patch.maxConcurrentRuns);
      if (!Number.isInteger(n) || n < 1 || n > 10) {
        throw new StoreError('INVALID_CONFIG', 'maxConcurrentRuns deve ser inteiro entre 1 e 10', 400);
      }
      board.config.maxConcurrentRuns = n;
    }
    if (patch.defaultEngine !== undefined) {
      const allowed = ['mock', 'claude', 'codex', 'cursor', 'antigravity'];
      if (!allowed.includes(patch.defaultEngine)) {
        throw new StoreError('INVALID_CONFIG', `Engine inválido: ${patch.defaultEngine}`, 400);
      }
      board.config.defaultEngine = patch.defaultEngine;
    }
    if (patch.defaultMode !== undefined) {
      if (!['impl', 'verify'].includes(patch.defaultMode)) {
        throw new StoreError('INVALID_CONFIG', `Modo inválido: ${patch.defaultMode}`, 400);
      }
      board.config.defaultMode = patch.defaultMode;
    }
    if (patch.theme !== undefined) {
      if (!ALLOWED_THEMES.has(patch.theme)) {
        throw new StoreError(
          'INVALID_CONFIG',
          `Tema inválido: "${patch.theme}". Use dark ou light.`,
          400,
        );
      }
      board.config.theme = patch.theme;
    }
    if (patch.boardViewMode !== undefined) {
      if (!ALLOWED_BOARD_VIEW_MODES.has(patch.boardViewMode)) {
        throw new StoreError(
          'INVALID_CONFIG',
          `Modo de visualização inválido: "${patch.boardViewMode}". Use dual ou unified.`,
          400,
        );
      }
      board.config.boardViewMode = patch.boardViewMode;
    }
    writeBoard(board);
    return board.config;
  }

  // ---- Atomic Locks (.specs/hub/locks/<id>.lock) ----
  function getLockPath(taskId) {
    validateTaskId(taskId);
    return safeJoin(locksDir, `${taskId}.lock`);
  }

  function isLockStale(holder) {
    if (!holder || typeof holder !== 'object') return false;
    if (holder.ttlMs > 0 && holder.acquiredAt) {
      const elapsed = Date.now() - Date.parse(holder.acquiredAt);
      if (Number.isFinite(elapsed) && elapsed > holder.ttlMs) return true;
    }
    if (holder.runId && holder.pid && !isProcessAlive(holder.pid)) {
      return true;
    }
    return false;
  }

  function getLock(taskId) {
    const lockPath = getLockPath(taskId);
    if (!existsSync(lockPath)) return null;
    try {
      return JSON.parse(readFileSync(lockPath, 'utf8'));
    } catch {
      return { taskId, agent: 'unknown', corrupted: true };
    }
  }

  function cleanupStaleLocks() {
    if (!existsSync(locksDir)) return [];
    const recovered = [];
    for (const file of readdirSync(locksDir)) {
      if (!file.endsWith('.lock')) continue;
      const fullPath = join(locksDir, file);
      try {
        const holder = JSON.parse(readFileSync(fullPath, 'utf8'));
        if (isLockStale(holder)) {
          unlinkSync(fullPath);
          recovered.push(holder);
        }
      } catch {
        // Ignore transient read race
      }
    }
    if (recovered.length > 0) {
      const board = readBoard();
      for (const h of recovered) {
        pushActivity(board, {
          actor: 'system',
          type: 'lock_recovered',
          taskId: h.taskId || null,
          message: `Lock órfão recuperado de ${h.agent || 'unknown'}`,
        });
      }
      writeBoard(board);
    }
    return recovered;
  }

  function acquireLock(
    taskId,
    { agent = 'user', engine = 'mock', runId = null, pid = process.pid, ttlMs = 0, previousStatus = null } = {},
  ) {
    const lockPath = getLockPath(taskId);
    mkdirSync(locksDir, { recursive: true });

    const payload = {
      taskId,
      agent,
      engine,
      runId,
      pid,
      ttlMs,
      previousStatus,
      acquiredAt: new Date().toISOString(),
    };

    const tryOpen = () => {
      const fd = openSync(lockPath, 'wx');
      try {
        writeSync(fd, JSON.stringify(payload, null, 2), 0, 'utf8');
      } finally {
        closeSync(fd);
      }
      return { ok: true, lock: payload };
    };

    try {
      return tryOpen();
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Lock already exists — inspect and recover if stale
    const holder = getLock(taskId);
    if (holder && !holder.corrupted && isLockStale(holder)) {
      try {
        unlinkSync(lockPath);
        recordActivity({
          actor: 'system',
          type: 'lock_recovered',
          taskId,
          message: `Lock expirado/órfão recuperado de ${holder.agent || 'unknown'}`,
        });
        return tryOpen();
      } catch (retryErr) {
        if (retryErr.code === 'EEXIST') {
          return { ok: false, holder: getLock(taskId) };
        }
        if (retryErr.code === 'ENOENT') {
          try {
            return tryOpen();
          } catch (e2) {
            if (e2.code === 'EEXIST') return { ok: false, holder: getLock(taskId) };
            throw e2;
          }
        }
        throw retryErr;
      }
    }

    return { ok: false, holder };
  }

  function releaseLock(taskId, { agent = null, runId = null, force = false } = {}) {
    const lockPath = getLockPath(taskId);
    if (!existsSync(lockPath)) {
      return { ok: true, released: false, holder: null };
    }
    const holder = getLock(taskId);
    if (!force && holder && !holder.corrupted) {
      const ownerMatch =
        (agent && holder.agent === agent) || (runId && holder.runId && holder.runId === runId);
      if (!ownerMatch) {
        return {
          ok: false,
          code: 'LOCK_NOT_OWNER',
          statusCode: 409,
          message: `Lock pertence a ${holder.agent}`,
          holder,
        };
      }
    }
    try {
      unlinkSync(lockPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    return { ok: true, released: true, holder };
  }

  // ---- Task reading & merging ----
  function resolveTaskFile(taskId) {
    validateTaskId(taskId);
    return safeJoin(tasksDir, `${taskId}.md`);
  }

  function buildMergedMeta(taskParsed, rawMeta = {}, defaultEngine = 'mock') {
    const tier = TIERS.includes(rawMeta.tier) ? rawMeta.tier : 'T2';
    const type = TYPES.includes(rawMeta.type) ? rawMeta.type : 'Feature';
    const priority = PRIORITIES.includes(rawMeta.priority) ? rawMeta.priority : 'P2';
    const sensitiveSurface = Boolean(rawMeta.sensitiveSurface);
    const userFacing = Boolean(rawMeta.userFacing);
    const meta = {
      priority,
      tier,
      type,
      boardLane: statusToDefaultLane(taskParsed.status, { ...rawMeta, type }),
      assignee: rawMeta.assignee || null,
      reviewer: rawMeta.reviewer || null,
      reviewersRequired: getRequiredReviewers({ tier, type, sensitiveSurface, userFacing }),
      reviewersApproved: Array.isArray(rawMeta.reviewersApproved) ? rawMeta.reviewersApproved : [],
      sensitiveSurface,
      userFacing,
      aiEngine: rawMeta.aiEngine || defaultEngine,
      order: typeof rawMeta.order === 'number' ? rawMeta.order : 0,
      blockedNeedsUser: Boolean(rawMeta.blockedNeedsUser),
      blockedFrom: taskParsed.blockedFrom || rawMeta.blockedFrom || null,
      schedule: rawMeta.schedule || null,
      githubIssue: rawMeta.githubIssue || null,
      createdAt: rawMeta.createdAt || new Date(taskParsed.mtimeMs || Date.now()).toISOString(),
    };
    return meta;
  }

  function readTaskById(taskId, board = null) {
    const filePath = resolveTaskFile(taskId);
    if (!existsSync(filePath)) return null;
    const b = board || readBoard();
    const stat = statSync(filePath);
    const rawText = readFileSync(filePath, 'utf8');
    const relPath = relative(root, filePath).replace(/\\/g, '/');
    const parsed = parseTaskMarkdown(rawText, { id: taskId, filePath: relPath, mtimeMs: stat.mtimeMs });
    const meta = buildMergedMeta(parsed, b.tasks[taskId] || {}, b.config.defaultEngine);
    const lock = getLock(taskId);
    return {
      ...parsed,
      blockedFrom: parsed.blockedFrom || (parsed.status === 'BLOCKED' ? meta.blockedFrom : null),
      meta,
      lock,
      activeRun: null,
    };
  }

  function listTasks() {
    if (!existsSync(tasksDir)) return [];
    const board = readBoard();
    const entries = readdirSync(tasksDir).filter((f) => f.endsWith('.md'));
    const tasks = [];
    for (const file of entries) {
      const id = file.slice(0, -3);
      if (!TASK_ID_RE.test(id)) continue;
      const task = readTaskById(id, board);
      if (task) tasks.push(task);
    }
    tasks.sort((a, b) => {
      const pDiff = (PRIORITY_RANK[a.meta.priority] ?? 2) - (PRIORITY_RANK[b.meta.priority] ?? 2);
      if (pDiff !== 0) return pDiff;
      if (a.meta.order !== b.meta.order) return a.meta.order - b.meta.order;
      return a.id.localeCompare(b.id);
    });
    return tasks;
  }

  function assertExpectedMtime(task, expectedMtimeMs) {
    if (expectedMtimeMs !== undefined && expectedMtimeMs !== null) {
      const diff = Math.abs(task.mtimeMs - Number(expectedMtimeMs));
      if (diff > 1) {
        throw new StoreError(
          'CONFLICT',
          'Arquivo alterado fora do Hub',
          409,
          { diskTask: task, currentMtimeMs: task.mtimeMs },
        );
      }
    }
  }

  // ---- Task mutations ----
  function createTask(input = {}) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) {
      throw new StoreError('TITLE_REQUIRED', 'Título obrigatório', 400);
    }

    const board = readBoard();
    const boardLane = input.boardLane || 'planned';
    if (!PLANNING_LANES.includes(boardLane)) {
      throw new StoreError(
        'INVALID_LANE',
        `Raia de criação inválida: "${boardLane}". Use ${PLANNING_LANES.join(', ')}.`,
        400,
      );
    }

    const tier = input.tier || 'T2';
    if (!TIERS.includes(tier)) {
      throw new StoreError('INVALID_TIER', `Tier inválido: "${tier}"`, 400);
    }

    const type = input.type || (boardLane === 'to_fix' ? 'Bug' : 'Feature');
    if (!TYPES.includes(type)) {
      throw new StoreError('INVALID_TYPE', `Tipo inválido: "${type}"`, 400);
    }

    const priority = input.priority || 'P2';
    if (!PRIORITIES.includes(priority)) {
      throw new StoreError('INVALID_PRIORITY', `Prioridade inválida: "${priority}"`, 400);
    }

    const assignee = input.assignee || null;
    const reviewer = input.reviewer || null;
    const reviewCheck = validateReviewerAssignment({ tier, assignee, reviewer });
    if (!reviewCheck.ok) {
      throw new StoreError(reviewCheck.code, reviewCheck.message, reviewCheck.statusCode);
    }

    const quickCreate = Boolean(input.quickCreate);
    const acs = Array.isArray(input.acceptanceCriteria)
      ? input.acceptanceCriteria.filter((a) => (typeof a === 'string' ? a.trim() : a?.text?.trim()))
      : [];
    if (!quickCreate && tier !== 'Prototype' && acs.length === 0) {
      throw new StoreError(
        'AC_REQUIRED',
        'Informe ao menos 1 critério de aceite para tarefas T2/T3/Hotfix',
        400,
      );
    }

    mkdirSync(tasksDir, { recursive: true });
    const prefix = input.idPrefix ? String(input.idPrefix).replace(/[^a-z0-9-]/gi, '').toLowerCase() : 'task';
    const baseSlug = `${prefix}-${slugify(title)}`;
    let candidateId = baseSlug;
    let suffix = 2;
    while (existsSync(resolveTaskFile(candidateId))) {
      candidateId = `${baseSlug}-${suffix++}`;
    }
    validateTaskId(candidateId);

    const filePath = resolveTaskFile(candidateId);
    const markdown = buildTaskMarkdown({ ...input, title, acceptanceCriteria: acs });
    atomicWriteFile(filePath, markdown);

    const now = new Date().toISOString();
    const existingOrders = Object.values(board.tasks).map((t) => (typeof t.order === 'number' ? t.order : 0));
    const nextOrder = existingOrders.length ? Math.max(...existingOrders) + 10 : 10;

    board.tasks[candidateId] = {
      priority,
      tier,
      type,
      boardLane,
      assignee,
      reviewer,
      reviewersApproved: Array.isArray(input.reviewersApproved) ? input.reviewersApproved : [],
      sensitiveSurface: Boolean(input.sensitiveSurface),
      userFacing: Boolean(input.userFacing),
      aiEngine: input.aiEngine || board.config.defaultEngine || 'mock',
      order: typeof input.order === 'number' ? input.order : nextOrder,
      blockedNeedsUser: false,
      blockedFrom: null,
      schedule: input.schedule || null,
      githubIssue: input.githubIssue || null,
      createdAt: now,
    };

    pushActivity(board, {
      actor: input.actor || 'user',
      engine: input.aiEngine || null,
      type: 'task_created',
      taskId: candidateId,
      message: `Tarefa criada: ${title}`,
    });
    writeBoard(board);

    return readTaskById(candidateId, board);
  }

  function updateTask(taskId, patch = {}, { actor = 'user', expectedMtimeMs } = {}) {
    validateTaskId(taskId);
    const board = readBoard();
    const task = readTaskById(taskId, board);
    if (!task) {
      throw new StoreError('NOT_FOUND', `Tarefa não encontrada: ${taskId}`, 404);
    }
    assertExpectedMtime(task, expectedMtimeMs);

    const meta = { ...(board.tasks[taskId] || {}), ...task.meta };
    const nextTier = patch.tier !== undefined ? patch.tier : meta.tier;
    const nextAssignee = patch.assignee !== undefined ? patch.assignee : meta.assignee;
    const nextReviewer = patch.reviewer !== undefined ? patch.reviewer : meta.reviewer;

    if (patch.tier !== undefined && !TIERS.includes(patch.tier)) {
      throw new StoreError('INVALID_TIER', `Tier inválido: "${patch.tier}"`, 400);
    }
    if (patch.type !== undefined && !TYPES.includes(patch.type)) {
      throw new StoreError('INVALID_TYPE', `Tipo inválido: "${patch.type}"`, 400);
    }
    if (patch.priority !== undefined && !PRIORITIES.includes(patch.priority)) {
      throw new StoreError('INVALID_PRIORITY', `Prioridade inválida: "${patch.priority}"`, 400);
    }
    if (patch.schedule && patch.schedule.destination && !DESTINATIONS.includes(patch.schedule.destination)) {
      throw new StoreError('INVALID_DESTINATION', `Destino inválido: "${patch.schedule.destination}"`, 400);
    }

    const reviewCheck = validateReviewerAssignment({
      tier: nextTier,
      assignee: nextAssignee,
      reviewer: nextReviewer,
    });
    if (!reviewCheck.ok) {
      throw new StoreError(reviewCheck.code, reviewCheck.message, reviewCheck.statusCode);
    }

    // Check if Prototype is being promoted to T2/T3 (AC-05.8)
    const promoted =
      (meta.tier === 'Prototype' || meta.type === 'Prototype') &&
      (nextTier === 'T2' || nextTier === 'T3');

    // Update markdown ONLY if markdown fields changed or promoted (AC-05.6)
    const mdFields = [
      'problem',
      'proof',
      'source',
      'outOfScope',
      'approach',
      'files',
      'testScope',
      'securityNotes',
      'needsFromUser',
      'acceptanceCriteria',
    ];
    const hasMdChange = promoted || mdFields.some((k) => patch[k] !== undefined);

    if (hasMdChange) {
      const filePath = resolveTaskFile(taskId);
      let rawText = readFileSync(filePath, 'utf8');
      if (patch.problem !== undefined) rawText = replaceSectionBody(rawText, 'Problem', patch.problem);
      if (patch.proof !== undefined) rawText = replaceSectionBody(rawText, 'Proof', patch.proof);
      if (patch.source !== undefined) rawText = replaceSectionBody(rawText, 'Source', patch.source);
      if (patch.approach !== undefined) rawText = replaceSectionBody(rawText, 'Approach', patch.approach);
      if (patch.testScope !== undefined) rawText = replaceSectionBody(rawText, 'Test scope', patch.testScope);
      if (patch.securityNotes !== undefined) {
        rawText = replaceSectionBody(rawText, 'Security notes', patch.securityNotes);
      }
      if (patch.needsFromUser !== undefined) {
        rawText = replaceSectionBody(rawText, 'Needs from user', patch.needsFromUser);
      }
      if (Array.isArray(patch.outOfScope)) {
        rawText = replaceSectionBody(
          rawText,
          'Out of scope',
          patch.outOfScope.map((o) => `- ${String(o).trim()}`).join('\n'),
        );
      }
      if (Array.isArray(patch.files)) {
        rawText = replaceSectionBody(
          rawText,
          'Files',
          patch.files.map((f) => `- \`${normalizeFilePath(String(f))}\``).join('\n'),
        );
      }
      if (Array.isArray(patch.acceptanceCriteria)) {
        const lines = patch.acceptanceCriteria.map((ac) => {
          if (typeof ac === 'string') return `- [ ] ${ac.trim()} — evidence: `;
          const mark = ac.done ? 'x' : ' ';
          const ev = ac.evidence ? String(ac.evidence).trim() : '';
          return `- [${mark}] ${String(ac.text || '').trim()} — evidence: ${ev}`;
        });
        rawText = replaceSectionBody(rawText, 'Acceptance criteria', lines.join('\n'));
      }
      if (promoted) {
        const today = new Date().toISOString().slice(0, 10);
        rawText = appendLogLine(rawText, `${today} — ${actor} — promovido de Prototype para ${nextTier}`);
      }
      atomicWriteFile(filePath, rawText);
    }

    // Update board.json metadata
    const nextMeta = {
      priority: patch.priority !== undefined ? patch.priority : meta.priority,
      tier: nextTier,
      type:
        patch.type !== undefined
          ? patch.type
          : promoted && meta.type === 'Prototype'
            ? 'Feature'
            : meta.type,
      boardLane:
        patch.boardLane !== undefined && PLANNING_LANES.includes(patch.boardLane) && task.status === 'PLANNING'
          ? patch.boardLane
          : meta.boardLane,
      assignee: nextAssignee,
      reviewer: nextReviewer,
      reviewersApproved: Array.isArray(patch.reviewersApproved)
        ? [...new Set(patch.reviewersApproved)]
        : meta.reviewersApproved || [],
      sensitiveSurface:
        patch.sensitiveSurface !== undefined ? Boolean(patch.sensitiveSurface) : meta.sensitiveSurface,
      userFacing: patch.userFacing !== undefined ? Boolean(patch.userFacing) : meta.userFacing,
      aiEngine: patch.aiEngine !== undefined ? patch.aiEngine : meta.aiEngine,
      order: typeof patch.order === 'number' ? patch.order : meta.order,
      blockedNeedsUser:
        patch.blockedNeedsUser !== undefined ? Boolean(patch.blockedNeedsUser) : meta.blockedNeedsUser,
      blockedFrom: meta.blockedFrom || null,
      schedule: patch.schedule !== undefined ? patch.schedule : meta.schedule,
      githubIssue: patch.githubIssue !== undefined ? patch.githubIssue : meta.githubIssue,
      createdAt: meta.createdAt || new Date().toISOString(),
    };

    board.tasks[taskId] = nextMeta;
    pushActivity(board, {
      actor,
      type: promoted ? 'task_promoted' : 'task_updated',
      taskId,
      message: promoted
        ? `Protótipo promovido para ${nextTier}`
        : `Tarefa atualizada (${task.title})`,
    });
    writeBoard(board);

    return readTaskById(taskId, board);
  }

  function toggleAc(taskId, acIndex, { done, evidence, text, actor = 'user', expectedMtimeMs } = {}) {
    validateTaskId(taskId);
    const board = readBoard();
    const task = readTaskById(taskId, board);
    if (!task) {
      throw new StoreError('NOT_FOUND', `Tarefa não encontrada: ${taskId}`, 404);
    }
    assertExpectedMtime(task, expectedMtimeMs);

    const existingAc = task.acceptanceCriteria[acIndex];
    if (!existingAc) {
      throw new StoreError('AC_NOT_FOUND', `Critério de aceite #${acIndex} não encontrado`, 404);
    }

    const nextDone = done !== undefined ? Boolean(done) : !existingAc.done;
    const nextEvidence = evidence !== undefined ? String(evidence).trim() : existingAc.evidence;

    if (nextDone && !nextEvidence) {
      throw new StoreError('EVIDENCE_REQUIRED', 'Evidência obrigatória', 400);
    }

    const filePath = resolveTaskFile(taskId);
    const rawText = readFileSync(filePath, 'utf8');
    const updatedText = updateAcLineInMarkdown(rawText, acIndex, {
      done: nextDone,
      evidence: nextEvidence,
      text,
    });
    atomicWriteFile(filePath, updatedText);

    pushActivity(board, {
      actor,
      type: 'ac_updated',
      taskId,
      message: `AC #${acIndex + 1} ${nextDone ? 'concluído' : 'reaberto'}`,
    });
    writeBoard(board);

    return readTaskById(taskId, board);
  }

  function moveTask(taskId, options = {}) {
    validateTaskId(taskId);
    const board = readBoard();
    const allTasks = listTasks();
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) {
      throw new StoreError('NOT_FOUND', `Tarefa não encontrada: ${taskId}`, 404);
    }
    assertExpectedMtime(task, options.expectedMtimeMs);

    const check = validateTransition(task, options, { allTasks });
    if (!check.ok) {
      throw new StoreError(check.code, check.message, check.statusCode, check.details);
    }

    const actor = options.actor || 'user';
    const existingMeta = board.tasks[taskId] || { ...task.meta };

    if (check.isLaneOnlyMove) {
      board.tasks[taskId] = {
        ...existingMeta,
        boardLane: check.toLane,
        order: typeof options.order === 'number' ? options.order : existingMeta.order ?? 0,
      };
      pushActivity(board, {
        actor,
        type: 'lane_moved',
        taskId,
        message: `Raia alterada para ${check.toLane}`,
      });
      writeBoard(board);
      return readTaskById(taskId, board);
    }

    // Lifecycle status transition — update markdown losslessly + append log (RN-08)
    const filePath = resolveTaskFile(taskId);
    let rawText = readFileSync(filePath, 'utf8');
    const statusLine = formatStatusLine({
      status: check.toStatus,
      blockedFrom: check.blockedFrom || null,
      blockedReason: check.blockedReason || '',
      supersededBy: check.supersededBy || '',
    });
    rawText = replaceStatusLine(rawText, statusLine);

    const today = new Date().toISOString().slice(0, 10);
    const extra =
      check.toStatus === 'BLOCKED'
        ? ` (${check.blockedReason})`
        : check.toStatus === 'SUPERSEDED'
          ? ` (${check.supersededBy})`
          : check.toStatus === 'SHIPPED'
            ? ' (Level C confirmado)'
            : '';
    rawText = appendLogLine(rawText, `${today} — ${actor} — ${check.fromStatus} → ${check.toStatus}${extra}`);
    atomicWriteFile(filePath, rawText);

    board.tasks[taskId] = {
      ...existingMeta,
      boardLane: check.toLane,
      order: typeof options.order === 'number' ? options.order : existingMeta.order ?? 0,
      blockedNeedsUser:
        check.toStatus === 'BLOCKED' ? Boolean(options.blockedNeedsUser) : false,
      blockedFrom: check.toStatus === 'BLOCKED' ? check.blockedFrom : null,
    };

    pushActivity(board, {
      actor,
      engine: options.engine || null,
      type: 'status_changed',
      taskId,
      message: `${check.fromStatus} → ${check.toStatus}${extra}`,
    });
    writeBoard(board);

    return readTaskById(taskId, board);
  }

  function blockTask(taskId, { reason, blockedNeedsUser = false, actor = 'user', expectedMtimeMs } = {}) {
    return moveTask(taskId, {
      toStatus: 'BLOCKED',
      toLane: 'blocked',
      reason,
      blockedNeedsUser,
      actor,
      expectedMtimeMs,
    });
  }

  function unblockTask(taskId, { actor = 'user', expectedMtimeMs } = {}) {
    validateTaskId(taskId);
    const task = readTaskById(taskId);
    if (!task) throw new StoreError('NOT_FOUND', `Tarefa não encontrada: ${taskId}`, 404);
    if (task.status !== 'BLOCKED') {
      throw new StoreError('NOT_BLOCKED', 'A tarefa não está bloqueada', 400);
    }
    const targetStatus = task.blockedFrom || task.meta?.blockedFrom || 'PLANNING';
    return moveTask(taskId, {
      toStatus: targetStatus,
      actor,
      expectedMtimeMs,
    });
  }

  // ---- Atomic Queue Claim & Release ----
  function claimTask(taskId, { agent, engine = 'mock', runId = null, ttlMs = 0 } = {}) {
    validateTaskId(taskId);
    if (!agent || typeof agent !== 'string') {
      throw new StoreError('AGENT_REQUIRED', 'Informe o agente para reivindicar a tarefa', 400);
    }

    const allTasks = listTasks();
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) {
      throw new StoreError('NOT_FOUND', `Tarefa não encontrada: ${taskId}`, 404);
    }

    // Validate role & eligibility before locking
    if (task.status === 'PLANNING') {
      if (READ_ONLY_AGENTS.has(agent) || agent === '@committer') {
        throw new StoreError('INELIGIBLE_AGENT', `${agent} não pode reivindicar Construir`, 422);
      }
      const assigned = task.meta?.schedule?.agent || task.meta?.assignee;
      if (assigned && assigned !== agent) {
        throw new StoreError(
          'WRONG_ASSIGNEE',
          `Tarefa atribuída a ${assigned}, não a ${agent}`,
          422,
        );
      }
      if (task.valid === false) {
        throw new StoreError('TASK_INVALID', 'Validador reprovou o arquivo de tarefa', 422, {
          validationErrors: task.validationErrors,
        });
      }
      const overlaps = findFileOverlaps(task, allTasks);
      if (overlaps.length > 0) {
        throw new StoreError(
          'FILE_CONFLICT',
          `Conflito de arquivos (RN-05) com ${overlaps[0].taskId}: ${overlaps[0].files.join(', ')}`,
          409,
          { overlaps },
        );
      }
    } else if (task.status === 'IN_REVIEW') {
      if (task.meta?.tier !== 'Prototype' && task.meta?.assignee === agent) {
        throw new StoreError('SELF_REVIEW_FORBIDDEN', 'O autor não revisa o próprio trabalho T2+', 422);
      }
      const required = getRequiredReviewers(task.meta);
      if (!required.includes(agent)) {
        throw new StoreError('NOT_REQUIRED_REVIEWER', `${agent} não é revisor pendente desta tarefa`, 422);
      }
    } else if (task.status === 'READY_TO_COMMIT') {
      if (agent !== '@committer') {
        throw new StoreError('COMMITTER_ONLY', 'Somente @committer reivindica itens Comitar', 403);
      }
    } else {
      throw new StoreError(
        'NOT_CLAIMABLE',
        `Tarefas em ${task.status} não podem ser reivindicadas`,
        422,
      );
    }

    // Atomic kernel lock via openSync(..., 'wx')
    const lockRes = acquireLock(taskId, {
      agent,
      engine,
      runId,
      ttlMs,
      previousStatus: task.status,
    });
    if (!lockRes.ok) {
      const h = lockRes.holder || {};
      throw new StoreError(
        'ALREADY_CLAIMED',
        `Já reivindicado por ${h.agent || 'outro agente'} (${h.engine || 'unknown'})`,
        409,
        { holder: h },
      );
    }

    let updatedTask = task;
    try {
      if (task.status === 'PLANNING') {
        updatedTask = moveTask(taskId, {
          toStatus: 'IN_PROGRESS',
          toLane: 'in_progress',
          actor: agent,
          engine,
        });
      }
      recordActivity({
        actor: agent,
        engine,
        type: 'task_claimed',
        taskId,
        message: `Reivindicada por ${agent} (${engine})`,
      });
    } catch (err) {
      releaseLock(taskId, { force: true });
      throw err;
    }

    return { ok: true, task: readTaskById(taskId), lock: lockRes.lock };
  }

  function releaseClaim(taskId, { agent = null, runId = null, force = false, reason = null } = {}) {
    validateTaskId(taskId);
    const task = readTaskById(taskId);
    if (!task) {
      throw new StoreError('NOT_FOUND', `Tarefa não encontrada: ${taskId}`, 404);
    }

    const rel = releaseLock(taskId, { agent, runId, force });
    if (!rel.ok) {
      throw new StoreError(rel.code, rel.message, rel.statusCode, { holder: rel.holder });
    }

    const prevStatus = rel.holder?.previousStatus;
    if (prevStatus === 'PLANNING' && task.status === 'IN_PROGRESS') {
      moveTask(taskId, {
        toStatus: 'PLANNING',
        toLane: 'queued',
        actor: agent || rel.holder?.agent || 'user',
      });
    }

    recordActivity({
      actor: agent || rel.holder?.agent || 'user',
      engine: rel.holder?.engine || null,
      type: 'task_released',
      taskId,
      message: reason ? `Lock liberado: ${reason}` : 'Lock liberado',
    });

    return { ok: true, released: rel.released, task: readTaskById(taskId) };
  }

  // ---- Read-only Repository Readers ----
  function readRoster(tasks = null, queue = null) {
    const agentsMdPath = join(root, 'AGENTS.md');
    const roster = [];

    if (existsSync(agentsMdPath)) {
      const lines = readFileSync(agentsMdPath, 'utf8').split(/\r?\n/);
      const start = lines.findIndex((l) => /^## Roster\s*$/.test(l));
      if (start >= 0) {
        const tableLines = lines.slice(start + 1);
        let inTable = false;
        for (const raw of tableLines) {
          const line = raw.trim();
          if (line.startsWith('|')) {
            inTable = true;
            if (/^\|[\s:|-]+\|$/.test(line)) continue;
            if (/^\|\s*Agent\b/i.test(line)) continue;
            const cells = line
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim());
            if (cells.length >= 4) {
              const name = cells[0].replace(/`/g, '').trim();
              if (!name.startsWith('@')) continue;
              const slug = name.slice(1);
              const role = cells[1];
              const writes = cells[2];
              const model = cells[3];
              const agentFile = join(agentsDir, `${slug}.md`);
              roster.push({
                name,
                role,
                writes,
                model,
                fileExists: existsSync(agentFile),
                readOnly: writes.toLowerCase() === 'nothing',
                reportsOnly: writes.toLowerCase().includes('report'),
                status: 'idle',
                currentTaskId: null,
                currentEngine: null,
                claimedAt: null,
                queueCount: 0,
                scheduledCount: 0,
              });
            }
          } else if (inTable) {
            break;
          }
        }
      }
    }

    // Fallback: scan .claude/agents/*.md if AGENTS.md had no table
    if (roster.length === 0 && existsSync(agentsDir)) {
      for (const file of readdirSync(agentsDir).filter((f) => f.endsWith('.md')).sort()) {
        const slug = file.slice(0, -3);
        const name = `@${slug}`;
        const raw = readFileSync(join(agentsDir, file), 'utf8');
        const descMatch = raw.match(/^description:\s*(.+)$/m);
        const modelMatch = raw.match(/^model:\s*(.+)$/m);
        roster.push({
          name,
          role: descMatch ? descMatch[1].trim() : slug,
          writes: READ_ONLY_AGENTS.has(name) ? 'nothing' : 'in scope',
          model: modelMatch ? modelMatch[1].trim() : 'inherit',
          fileExists: true,
          readOnly: name === '@explorer',
          reportsOnly: name === '@code-reviewer' || name === '@security-auditor',
          status: 'idle',
          currentTaskId: null,
          currentEngine: null,
          claimedAt: null,
          queueCount: 0,
          scheduledCount: 0,
        });
      }
    }

    // Enrich dynamic runtime status from tasks & queue (AC-12.2..12.4)
    if (Array.isArray(tasks)) {
      const q = queue || computeQueue(tasks);
      for (const agent of roster) {
        const claimed = tasks.find((t) => t.lock && t.lock.agent === agent.name);
        if (claimed) {
          agent.currentTaskId = claimed.id;
          agent.currentEngine = claimed.lock.engine || null;
          agent.claimedAt = claimed.lock.acquiredAt || null;
          if (claimed.status === 'BLOCKED') agent.status = 'blocked';
          else if (claimed.status === 'IN_PROGRESS' || claimed.status === 'IN_REVIEW') {
            agent.status = 'active';
          }
        }
        agent.queueCount = q.eligible.filter((i) => i.targetAgent === agent.name).length;
        agent.scheduledCount = tasks.filter(
          (t) =>
            t.meta?.schedule?.day &&
            (t.meta.schedule.agent || t.meta.assignee) === agent.name,
        ).length;
      }
    }

    return roster;
  }

  function readIncidents() {
    if (!existsSync(incidentsPath)) {
      return { open: [], fixed: [], fixedCount: 0, total: 0 };
    }
    const byKey = new Map();
    const lines = readFileSync(incidentsPath, 'utf8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      const s = byKey.get(e.key) ?? { key: e.key, count: 0, status: 'open', upstream: 'n/a' };
      if (e.type === 'occurrence') {
        s.count += 1;
        s.status = 'open';
        Object.assign(s, { layer: e.layer, what: e.what, where: e.where, last: e.date });
        s.first ??= e.date;
      } else if (e.type === 'fix') {
        Object.assign(s, { status: 'fixed', fix: e.fix, upstream: e.upstream, fixed: e.date });
      } else if (e.type === 'upstreamed') {
        s.upstream = 'done';
      }
      byKey.set(e.key, s);
    }
    const all = [...byKey.values()];
    const open = all.filter((s) => s.status === 'open');
    const fixed = all.filter((s) => s.status === 'fixed');
    return { open, fixed, fixedCount: fixed.length, total: all.length };
  }

  function readGates() {
    const claudePath = join(root, 'CLAUDE.md');
    if (!existsSync(claudePath)) return [];
    const lines = readFileSync(claudePath, 'utf8').split(/\r?\n/);
    const start = lines.findIndex((l) => /^## Verification\s*$/.test(l));
    if (start < 0) return [];
    const next = lines.findIndex((l, i) => i > start && /^#{1,2} /.test(l));
    const section = lines.slice(start + 1, next < 0 ? lines.length : next);
    const header = section.findIndex((l) => /^\|\s*Gate\b/.test(l));
    if (header < 0) return [];

    const gates = [];
    for (const raw of section.slice(header + 1)) {
      const line = raw.trim();
      if (!line.startsWith('|')) break;
      if (/^\|[\s:|-]+\|$/.test(line)) continue;
      const row = line.match(/^\|\s*([^|`]+?)\s*\|\s*`(.+)`\s*\|\s*([^|]*?)\s*\|$/);
      if (!row) continue;
      const [, name, command, baselineRaw] = row;
      const baseline = baselineRaw || 'exit0';
      const safeName = name.replace(/[^\w.-]+/g, '-');
      const logFile = `.specs/logs/gate-${safeName}.log`;
      const absLog = join(logsDir, `gate-${safeName}.log`);

      let status = 'never';
      let lastRunAt = null;
      let warnings = 0;
      let tail = '';

      if (existsSync(absLog)) {
        try {
          const stat = statSync(absLog);
          lastRunAt = new Date(stat.mtimeMs).toISOString();
          const content = readFileSync(absLog, 'utf8').trimEnd();
          const logLines = content ? content.split(/\r?\n/) : [];
          tail = logLines.slice(-50).join('\n');
          const warnMatch = content.match(/(\d+)\s+warnings?/i);
          if (warnMatch) {
            warnings = Number(warnMatch[1]);
          } else {
            warnings = logLines.filter((l) => /^warn\s/i.test(l)).length;
          }
          if (/\bFAIL\b|^ERROR\s/m.test(content)) status = 'fail';
          else if (/\bPASS\b/m.test(content) || logLines.length > 0) status = 'pass';
        } catch {
          status = 'never';
        }
      }

      gates.push({
        name,
        command,
        baseline,
        status,
        lastRunAt,
        warnings,
        tail,
        logFile,
      });
    }
    return gates;
  }

  function getQueue({ agent = null, today = null } = {}) {
    const tasks = listTasks();
    return computeQueue(tasks, { agent, today });
  }

  function getState() {
    const board = readBoard();
    const tasks = listTasks();
    const queue = computeQueue(tasks);
    const roster = readRoster(tasks, queue);
    const gates = readGates();
    const incidents = readIncidents();
    return {
      ok: true,
      repoRoot: root,
      config: board.config,
      tasks,
      queue,
      roster,
      gates,
      incidents,
      activity: board.activity.slice(0, 20),
    };
  }

  /**
   * Watches repository files with 250ms debounce and emits change notifications.
   */
  function watch(onChange, onError = () => {}) {
    const watchers = [];
    let timer = null;
    const emit = (reason) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          onChange({ reason });
        } catch {
          // ignore callback errors
        }
      }, 250);
    };

    const targets = [tasksDir, hubDir, logsDir, join(specsDir, 'harness')];
    for (const dir of targets) {
      if (!existsSync(dir)) continue;
      try {
        const w = fsWatch(dir, { persistent: false }, (_eventType, filename) => {
          if (filename && String(filename).includes('.tmp-')) return;
          emit(filename ? `${basename(dir)}/${filename}` : basename(dir));
        });
        w.on('error', (err) => onError(err));
        watchers.push(w);
      } catch (err) {
        onError(err);
      }
    }

    return {
      close() {
        clearTimeout(timer);
        for (const w of watchers) {
          try {
            w.close();
          } catch {
            // ignore
          }
        }
      },
    };
  }

  return {
    rootDir: root,
    tasksDir,
    hubDir,
    locksDir,
    boardPath,
    readBoard,
    updateConfig,
    recordActivity,
    listTasks,
    getTask: (id) => readTaskById(id),
    createTask,
    updateTask,
    toggleAc,
    moveTask,
    blockTask,
    unblockTask,
    acquireLock,
    releaseLock,
    getLock,
    cleanupStaleLocks,
    claimTask,
    releaseClaim,
    readRoster,
    readIncidents,
    readGates,
    getQueue,
    getState,
    watch,
  };
}
