import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

export const MANIFEST_REL_PATH = '.specs/hub/adapters-manifest.json';

export const PLATFORMS = Object.freeze([
  Object.freeze({
    id: 'claude',
    name: 'Claude Code',
    binary: 'claude',
    native: true,
    targetPath: 'CLAUDE.md',
  }),
  Object.freeze({
    id: 'antigravity',
    name: 'Antigravity',
    binary: 'agy',
    native: false,
    targetPath: '.gemini/rules/harness.md',
  }),
  Object.freeze({
    id: 'codex',
    name: 'Codex',
    binary: 'codex',
    native: false,
    targetPath: '.agents/rules/harness.md',
  }),
  Object.freeze({
    id: 'cursor',
    name: 'Cursor',
    binary: 'agent',
    native: false,
    targetPath: '.cursor/rules/harness.mdc',
  }),
]);

const PLATFORM_MAP = new Map(PLATFORMS.map((p) => [p.id, p]));
const PROJECTED_PLATFORM_IDS = PLATFORMS.filter((p) => !p.native).map((p) => p.id);

/**
 * Normalize line endings to LF for deterministic hashing across OSes.
 * @param {string} text
 * @returns {string}
 */
function normalizeLf(text) {
  return String(text).replace(/\r\n/g, '\n');
}

/**
 * Compute SHA-256 hex digest of a string or Buffer.
 * @param {string | Buffer} content
 * @returns {string}
 */
export function sha256(content) {
  return createHash('sha256').update(content, typeof content === 'string' ? 'utf8' : undefined).digest('hex');
}

/**
 * Resolve a relative path strictly inside rootDir (prevents path traversal).
 * @param {string} rootDir
 * @param {string} relPath
 * @returns {string}
 */
function safeResolveInside(rootDir, relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0 || relPath.includes('\0')) {
    throw new Error(`Invalid relative path: ${String(relPath)}`);
  }
  const absRoot = resolve(rootDir);
  const absTarget = resolve(absRoot, relPath);
  if (absTarget !== absRoot && !absTarget.startsWith(absRoot + sep)) {
    throw new Error(`Path traversal rejected: ${relPath}`);
  }
  return absTarget;
}

/**
 * Atomic file write (write temp file in same directory + renameSync).
 * @param {string} filePath
 * @param {string} content
 */
function writeFileAtomic(filePath, content) {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}.tmp`;
  try {
    writeFileSync(tmpPath, content, 'utf8');
    renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      // ignore cleanup error
    }
    throw err;
  }
}

/**
 * Parse YAML-like frontmatter from an agent markdown file.
 * @param {string} text
 * @returns {Record<string, string> | null}
 */
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) {
      out[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return out;
}

/**
 * Read canonical harness sources from rootDir:
 * - CLAUDE.md (constitution up to "# Project")
 * - AGENTS.md (roster & non-negotiables)
 * - .claude/rules/*.md (sorted numerically, including 80-prompt-amplifier.md)
 * - .claude/agents/*.md (sorted alphabetically)
 *
 * @param {string} rootDir
 */
export function readCanonicalSources(rootDir) {
  const absRoot = resolve(rootDir);
  const claudeMdPath = safeResolveInside(absRoot, 'CLAUDE.md');
  const agentsMdPath = safeResolveInside(absRoot, 'AGENTS.md');
  const rulesDir = safeResolveInside(absRoot, '.claude/rules');
  const agentsDir = safeResolveInside(absRoot, '.claude/agents');

  const claudeMdRaw = existsSync(claudeMdPath) ? normalizeLf(readFileSync(claudeMdPath, 'utf8')) : '';
  const constitution = claudeMdRaw.split(/^# Project[ \t]*$/m)[0].trim();
  const agentsMd = existsSync(agentsMdPath) ? normalizeLf(readFileSync(agentsMdPath, 'utf8')).trim() : '';

  const ruleFiles = existsSync(rulesDir)
    ? readdirSync(rulesDir)
        .filter((f) => f.endsWith('.md'))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    : [];

  const rules = ruleFiles.map((file) => {
    const relPath = `.claude/rules/${file}`;
    const content = normalizeLf(readFileSync(safeResolveInside(absRoot, relPath), 'utf8')).trim();
    return { file, relPath, content };
  });

  const promptAmplifierRule = rules.find((r) => r.file === '80-prompt-amplifier.md') || null;
  const promptAmplifier = promptAmplifierRule ? promptAmplifierRule.content : '';
  const promptAmplifierIncluded = Boolean(promptAmplifier && promptAmplifier.length > 0);

  const agentFiles = existsSync(agentsDir)
    ? readdirSync(agentsDir)
        .filter((f) => f.endsWith('.md'))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    : [];

  const agents = agentFiles.map((file) => {
    const relPath = `.claude/agents/${file}`;
    const content = normalizeLf(readFileSync(safeResolveInside(absRoot, relPath), 'utf8'));
    const fm = parseFrontmatter(content) || {};
    const name = fm.name || file.replace(/\.md$/, '');
    return {
      file,
      relPath,
      name,
      description: fm.description || '',
      model: fm.model || 'inherit',
      content: content.trim(),
    };
  });

  const hashPayload = JSON.stringify({
    constitution,
    agentsMd,
    rules: rules.map((r) => ({ file: r.file, content: r.content })),
    agents: agents.map((a) => ({ file: a.file, name: a.name, description: a.description, model: a.model })),
  });
  const canonicalHash = sha256(hashPayload);

  return {
    rootDir: absRoot,
    hasClaudeMd: existsSync(claudeMdPath),
    hasAgentsMd: existsSync(agentsMdPath),
    constitution,
    agentsMd,
    rules,
    ruleCount: rules.length,
    promptAmplifier,
    promptAmplifierIncluded,
    agents,
    canonicalHash,
  };
}

/**
 * Build the shared body of a canonical projection (deterministic, zero timestamps).
 * @param {ReturnType<typeof readCanonicalSources>} canonical
 * @param {string} engineId
 * @returns {string}
 */
function buildProjectionBody(canonical, engineId) {
  const sections = [];

  if (canonical.constitution) {
    sections.push(`## Constitution (from CLAUDE.md)\n\n${canonical.constitution}`);
  }

  if (canonical.promptAmplifier) {
    sections.push(`## Prompt Amplifier (from .claude/rules/80-prompt-amplifier.md)\n\n${canonical.promptAmplifier}`);
  }

  if (canonical.agentsMd) {
    sections.push(`## Team Roster & Non-negotiables (from AGENTS.md)\n\n${canonical.agentsMd}`);
  }

  const otherRules = canonical.rules.filter((r) => r.file !== '80-prompt-amplifier.md');
  if (otherRules.length > 0) {
    const renderedRules = otherRules
      .map((r) => `### Rule: ${r.file}\n\n${r.content}`)
      .join('\n\n---\n\n');
    sections.push(`## Canonical Rules (.claude/rules/)\n\n${renderedRules}`);
  }

  if (canonical.agents.length > 0) {
    const rows = canonical.agents
      .map((a) => {
        const desc = a.description.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
        return `| \`@${a.name}\` | ${a.model} | ${desc} |`;
      })
      .join('\n');
    sections.push(
      `## Agent Profiles (.claude/agents/)\n\n| Agent | Model | Purpose |\n|---|---|---|\n${rows}`,
    );
  }

  sections.push(
    [
      '## Harness Hub Queue CLI',
      '',
      'Use the local Harness Hub CLI to inspect the eligible queue, claim tasks atomically, release locks, and verify Multi-AI rule parity:',
      '',
      '```bash',
      '# List eligible tasks for your agent role',
      'node scripts/hub.mjs queue --agent @developer --json',
      '',
      '# Atomically claim a task before editing files',
      `node scripts/hub.mjs claim <taskId> --agent @developer --engine ${engineId}`,
      '',
      '# Release a task lock if blocked or handing off',
      'node scripts/hub.mjs release <taskId> --agent @developer --reason "<reason>"',
      '',
      '# Check or sync Multi-AI canonical projections',
      'node scripts/sync-adapters.mjs --check',
      '```',
    ].join('\n'),
  );

  return sections.join('\n\n---\n\n');
}

/**
 * Deterministically generate the projection content for a given platform.
 * @param {'antigravity' | 'codex' | 'cursor'} platformId
 * @param {ReturnType<typeof readCanonicalSources>} canonical
 * @returns {{ platformId: string, relPath: string, content: string, sha256: string }}
 */
export function generateProjection(platformId, canonical) {
  const platform = PLATFORM_MAP.get(platformId);
  if (!platform || platform.native) {
    throw new Error(`Cannot generate projection for platform: ${String(platformId)}`);
  }

  const marker = `<!-- GENERATED BY scripts/sync-adapters.mjs | canonical:${canonical.canonicalHash} | DO NOT EDIT MANUALLY -->`;
  const body = buildProjectionBody(canonical, platformId);
  let content;

  if (platformId === 'antigravity') {
    content = [
      marker,
      '',
      '# Harness Rules — Antigravity Projection',
      '',
      '> Canonical source: `CLAUDE.md`, `AGENTS.md`, `.claude/rules/*.md`, `.claude/agents/*.md`.',
      '',
      body,
      '',
    ].join('\n');
  } else if (platformId === 'codex') {
    content = [
      marker,
      '',
      '# Harness Rules — Codex Projection',
      '',
      '> Canonical source: `CLAUDE.md`, `AGENTS.md` (root roster), `.claude/rules/*.md`, `.claude/agents/*.md`.',
      '',
      body,
      '',
    ].join('\n');
  } else if (platformId === 'cursor') {
    content = [
      '---',
      'description: Harness team rules including 4-part prompt amplifier',
      'alwaysApply: true',
      '---',
      '',
      marker,
      '',
      '# Harness Rules — Cursor Projection',
      '',
      '> Canonical source: `CLAUDE.md`, `AGENTS.md`, `.claude/rules/*.md`, `.claude/agents/*.md`.',
      '',
      body,
      '',
    ].join('\n');
  } else {
    throw new Error(`Unsupported platform: ${String(platformId)}`);
  }

  content = normalizeLf(content);
  return {
    platformId,
    relPath: platform.targetPath,
    content,
    sha256: sha256(content),
  };
}

/**
 * Generate projections for all non-native platforms.
 * @param {ReturnType<typeof readCanonicalSources>} canonical
 */
export function generateAllProjections(canonical) {
  return PROJECTED_PLATFORM_IDS.map((id) => generateProjection(id, canonical));
}

/**
 * Detect if an AI CLI binary is installed on PATH (shell: false, cross-platform).
 * @param {string} binary
 * @returns {{ installed: boolean, version: string | null }}
 */
export function detectCliBinary(binary) {
  if (typeof binary !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(binary)) {
    return { installed: false, version: null };
  }

  const locator = process.platform === 'win32' ? 'where' : 'which';
  let foundPath = null;
  try {
    const out = execFileSync(locator, [binary], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
      shell: false,
    });
    const firstLine = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (firstLine) foundPath = firstLine;
  } catch {
    return { installed: false, version: null };
  }

  if (!foundPath) {
    return { installed: false, version: null };
  }

  let version = null;
  try {
    const out = execFileSync(foundPath, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 1500,
      shell: false,
    });
    const line = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (line) version = line.slice(0, 120);
  } catch {
    version = null;
  }

  return { installed: true, version };
}

/**
 * Read `.specs/hub/adapters-manifest.json` if present.
 * @param {string} rootDir
 */
export function readManifest(rootDir) {
  const manifestPath = safeResolveInside(rootDir, MANIFEST_REL_PATH);
  if (!existsSync(manifestPath)) {
    return { version: 1, canonicalHash: null, updatedAt: null, files: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') {
      return { version: 1, canonicalHash: null, updatedAt: null, files: {} };
    }
    return {
      version: parsed.version || 1,
      canonicalHash: parsed.canonicalHash || null,
      updatedAt: parsed.updatedAt || null,
      files: parsed.files && typeof parsed.files === 'object' ? parsed.files : {},
    };
  } catch {
    return { version: 1, canonicalHash: null, updatedAt: null, files: {} };
  }
}

/**
 * Write `.specs/hub/adapters-manifest.json` atomically.
 * @param {string} rootDir
 * @param {object} manifest
 */
function writeManifest(rootDir, manifest) {
  const manifestPath = safeResolveInside(rootDir, MANIFEST_REL_PATH);
  writeFileAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Run `scripts/validate-harness.mjs --root <rootDir>` if present in rootDir.
 * @param {string} rootDir
 */
function runHarnessValidator(rootDir) {
  const validatorPath = safeResolveInside(rootDir, 'scripts/validate-harness.mjs');
  if (!existsSync(validatorPath)) {
    return {
      pass: true,
      skipped: true,
      errors: 0,
      warnings: 0,
      output: 'validate-harness.mjs not present in rootDir',
    };
  }

  try {
    const output = execFileSync(process.execPath, [validatorPath, '--root', resolve(rootDir)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
      shell: false,
    });
    const m = output.match(/Validator:\s*(PASS|FAIL)\s*\((\d+)\s*errors?,\s*(\d+)\s*warnings?\)/i);
    return {
      pass: true,
      skipped: false,
      errors: m ? Number(m[2]) : 0,
      warnings: m ? Number(m[3]) : 0,
      output: output.trim(),
    };
  } catch (err) {
    const output = `${err.stdout || ''}\n${err.stderr || ''}`.trim();
    const m = output.match(/Validator:\s*(PASS|FAIL)\s*\((\d+)\s*errors?,\s*(\d+)\s*warnings?\)/i);
    return {
      pass: false,
      skipped: false,
      errors: m ? Number(m[2]) : 1,
      warnings: m ? Number(m[3]) : 0,
      output: output || err.message,
    };
  }
}

/**
 * Inspect live parity and drift status for all 4 AI platforms.
 * @param {string} rootDir
 * @param {{ skipCliCheck?: boolean }} [options]
 */
export function getAdaptersStatus(rootDir, options = {}) {
  const { skipCliCheck = false } = options;
  const canonical = readCanonicalSources(rootDir);
  const manifest = readManifest(rootDir);

  const platforms = PLATFORMS.map((platform) => {
    const cli = skipCliCheck ? { installed: false, version: null } : detectCliBinary(platform.binary);

    if (platform.native) {
      const files = [
        {
          path: 'CLAUDE.md',
          state: 'synced',
          manuallyEdited: false,
          canonicalSha256: canonical.canonicalHash,
          expectedSha256: canonical.canonicalHash,
          actualSha256: canonical.canonicalHash,
          lastSyncedAt: manifest.updatedAt,
        },
      ];

      return {
        id: platform.id,
        name: platform.name,
        binary: platform.binary,
        installed: cli.installed,
        version: cli.version,
        status: 'synced',
        reason: 'Fonte canônica nativa (.claude/rules/ + CLAUDE.md)',
        targetPath: platform.targetPath,
        hash: canonical.canonicalHash,
        expectedHash: canonical.canonicalHash,
        lastSyncedAt: manifest.updatedAt,
        ruleCount: canonical.ruleCount,
        promptAmplifierIncluded: canonical.promptAmplifierIncluded,
        manuallyEdited: false,
        files,
      };
    }

    const projection = generateProjection(platform.id, canonical);
    const absTarget = safeResolveInside(rootDir, projection.relPath);
    const manifestEntry = manifest.files[projection.relPath] || null;
    const lastSyncedAt = manifestEntry?.syncedAt || null;

    let fileState = 'missing';
    let manuallyEdited = false;
    let actualSha256 = null;
    let reason = '1 arquivo ausente';

    if (existsSync(absTarget)) {
      const actualContent = normalizeLf(readFileSync(absTarget, 'utf8'));
      actualSha256 = sha256(actualContent);

      if (actualSha256 === projection.sha256) {
        fileState = 'synced';
        manuallyEdited = false;
        reason = 'Em paridade com a fonte canônica';
      } else if (manifestEntry && actualSha256 === manifestEntry.sha256) {
        fileState = 'drifted';
        manuallyEdited = false;
        reason = 'Fonte canônica atualizada (sync seguro)';
      } else {
        fileState = 'drifted';
        manuallyEdited = true;
        reason = 'Projeção editada manualmente (requer confirmação)';
      }
    }

    return {
      id: platform.id,
      name: platform.name,
      binary: platform.binary,
      installed: cli.installed,
      version: cli.version,
      status: fileState,
      reason,
      targetPath: projection.relPath,
      hash: actualSha256,
      expectedHash: projection.sha256,
      lastSyncedAt,
      ruleCount: canonical.ruleCount,
      promptAmplifierIncluded: canonical.promptAmplifierIncluded,
      manuallyEdited,
      files: [
        {
          path: projection.relPath,
          state: fileState,
          manuallyEdited,
          canonicalSha256: canonical.canonicalHash,
          expectedSha256: projection.sha256,
          actualSha256,
          lastSyncedAt,
        },
      ],
    };
  });

  const inParityCount = platforms.filter((p) => p.status === 'synced').length;

  return {
    inParityCount,
    total: platforms.length,
    canonicalHash: canonical.canonicalHash,
    includesPromptAmplifier: canonical.promptAmplifierIncluded,
    promptAmplifierIncluded: canonical.promptAmplifierIncluded,
    ruleCount: canonical.ruleCount,
    platforms,
  };
}

/**
 * Resolve target platform IDs from options.
 * @param {string[] | string | undefined} rawTargets
 * @returns {string[]}
 */
function resolveTargetPlatforms(rawTargets) {
  if (!rawTargets || rawTargets === 'all') {
    return [...PROJECTED_PLATFORM_IDS];
  }
  const list = Array.isArray(rawTargets)
    ? rawTargets
    : String(rawTargets)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  if (list.length === 0 || list.includes('all')) {
    return [...PROJECTED_PLATFORM_IDS];
  }

  const resolved = [];
  for (const id of list) {
    if (!PLATFORM_MAP.has(id)) {
      throw new Error(`Unknown platform "${id}". Valid platforms: ${PLATFORMS.map((p) => p.id).join(', ')}`);
    }
    if (!PLATFORM_MAP.get(id).native && !resolved.includes(id)) {
      resolved.push(id);
    }
  }
  return resolved;
}

/**
 * Synchronize canonical projections atomically and update `.specs/hub/adapters-manifest.json`.
 *
 * @param {string} rootDir
 * @param {{
 *   targets?: string[] | string,
 *   platforms?: string[] | string,
 *   dryRun?: boolean,
 *   confirmOverwrite?: boolean,
 *   force?: boolean,
 *   runValidator?: boolean,
 *   skipCliCheck?: boolean,
 * }} [options]
 */
export function syncAdapters(rootDir, options = {}) {
  const {
    targets,
    platforms,
    dryRun = false,
    confirmOverwrite = false,
    force = false,
    runValidator = true,
    skipCliCheck = false,
  } = options;

  const allowOverwrite = Boolean(confirmOverwrite || force);
  const selectedIds = resolveTargetPlatforms(targets ?? platforms);
  const canonical = readCanonicalSources(rootDir);
  const manifest = readManifest(rootDir);
  const currentStatus = getAdaptersStatus(rootDir, { skipCliCheck });

  const create = [];
  const update = [];
  const overwriteManual = [];
  const unchanged = [];
  const plan = [];

  for (const id of selectedIds) {
    const projection = generateProjection(id, canonical);
    const platStatus = currentStatus.platforms.find((p) => p.id === id);
    const fileInfo = platStatus.files[0];

    if (fileInfo.state === 'synced') {
      unchanged.push(projection.relPath);
      continue;
    }

    if (fileInfo.state === 'missing') {
      create.push(projection.relPath);
      plan.push({ projection, action: 'create' });
    } else if (fileInfo.manuallyEdited) {
      overwriteManual.push(projection.relPath);
      plan.push({ projection, action: 'overwriteManual' });
    } else {
      update.push(projection.relPath);
      plan.push({ projection, action: 'update' });
    }
  }

  const preview = { create, update, overwriteManual, unchanged };

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      written: [],
      unchanged,
      preview,
      status: currentStatus,
    };
  }

  if (overwriteManual.length > 0 && !allowOverwrite) {
    return {
      ok: false,
      error: 'CONFIRM_OVERWRITE',
      message: 'Projeções editadas manualmente exigem confirmação explícita antes de sobrescrever.',
      overwriteManual,
      written: [],
      unchanged,
      preview,
      status: currentStatus,
    };
  }

  const now = new Date().toISOString();
  const written = [];
  const nextManifest = {
    version: 1,
    canonicalHash: canonical.canonicalHash,
    updatedAt: manifest.updatedAt || now,
    files: { ...manifest.files },
  };

  for (const { projection } of plan) {
    const absTarget = safeResolveInside(rootDir, projection.relPath);
    writeFileAtomic(absTarget, projection.content);
    written.push(projection.relPath);
    nextManifest.files[projection.relPath] = {
      platform: projection.platformId,
      sha256: projection.sha256,
      canonicalHash: canonical.canonicalHash,
      ruleCount: canonical.ruleCount,
      promptAmplifierIncluded: canonical.promptAmplifierIncluded,
      syncedAt: now,
    };
  }

  // Ensure manifest exists or is updated when any file was written or manifest was missing
  const manifestAbsPath = safeResolveInside(rootDir, MANIFEST_REL_PATH);
  if (written.length > 0 || !existsSync(manifestAbsPath)) {
    nextManifest.updatedAt = now;
    writeManifest(rootDir, nextManifest);
  }

  const validator = runValidator
    ? runHarnessValidator(rootDir)
    : { pass: true, skipped: true, errors: 0, warnings: 0, output: '' };

  const status = getAdaptersStatus(rootDir, { skipCliCheck });

  return {
    ok: validator.pass,
    dryRun: false,
    written,
    unchanged,
    preview,
    validator,
    status,
  };
}
