// Multi-Workspace manager for Harness Hub.
// Discovers direct child project folders inside `workspacesDir` (default: parent of primaryRootDir),
// detects Git branch via fast direct `.git/HEAD` reads (zero subprocesses), enforces strict
// containment / symlink / dot-folder security, and caches isolated per-workspace stores & runners.
// Zero dependencies — Node.js v24 native ESM.

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { syncAdapters } from './adapters.mjs';
import { createRunner } from './runner.mjs';
import { createStore, StoreError, TASK_ID_RE } from './store.mjs';

const IS_WIN = process.platform === 'win32';
const SHORT_SHA_RE = /^[0-9a-f]{7,40}$/i;
const NEW_WORKSPACE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,63}$/;
const WINDOWS_RESERVED_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

const CLAUDE_PROJECT_TEMPLATE = `# Project

<!-- Project-specific. Filled in on the first task; correct what is wrong. -->

## What this is

## Commands
| Purpose | Command |
|---------|---------|
| Dev | |
| Test (scoped) | |
| Build | |

## Verification
Kind: <web | mobile | dashboard | pipeline | analysis | cli-lib | infra>

| Gate | Command | Baseline |
|------|---------|----------|

| Surface | Proves it | Command or step |
|---------|-----------|-----------------|

Delivered means:

## Conventions

## Standing instructions
<!-- Empty = solo default: gated work lands on the local main line, one commit per task; push asks once. Write "always push when green" to push without asking, or "collaboration mode" for branch + PR with layered commits. -->

## Context index

## Lessons learned
`;

const HARNESS_GITIGNORE_ENTRIES = [
  '.specs/logs/',
  'prototypes/**/node_modules/',
  '.taste-skill/',
];

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
      // ignore cleanup failure
    }
    throw err;
  }
}

function normalizeForCompare(p) {
  const resolved = resolve(p);
  return IS_WIN ? resolved.toLowerCase() : resolved;
}

function isStrictChildPath(baseDir, candidatePath) {
  const base = normalizeForCompare(baseDir);
  const target = normalizeForCompare(candidatePath);
  const baseWithSep = base.endsWith(sep) ? base : base + sep;
  return target !== base && target.startsWith(baseWithSep);
}

/**
 * Validates a workspace folder ID against traversal, path separators, and hidden dot-folders.
 *
 * @param {string} id
 * @returns {string}
 */
export function validateWorkspaceId(id) {
  if (typeof id !== 'string') {
    throw new StoreError('INVALID_WORKSPACE_ID', 'ID de workspace inválido ou ausente.', 400);
  }
  const trimmed = id.trim();
  if (
    !trimmed ||
    trimmed !== id ||
    trimmed.startsWith('.') ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('\0') ||
    trimmed.includes('..') ||
    basename(trimmed) !== trimmed
  ) {
    throw new StoreError(
      'INVALID_WORKSPACE_ID',
      `ID de workspace inválido: "${id}". Selecione uma pasta direta válida.`,
      400,
    );
  }
  return trimmed;
}

/**
 * Validates a new workspace folder name against strict character, length, traversal,
 * path separator, and Windows reserved device name rules.
 *
 * @param {string} name
 * @returns {string}
 */
export function validateNewWorkspaceName(name) {
  if (typeof name !== 'string') {
    throw new StoreError(
      'INVALID_WORKSPACE_NAME',
      'Nome do projeto inválido ou ausente.',
      400,
    );
  }
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed.length > 64 ||
    trimmed.includes('..') ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('\0') ||
    trimmed.endsWith('.') ||
    basename(trimmed) !== trimmed ||
    !NEW_WORKSPACE_NAME_RE.test(trimmed) ||
    WINDOWS_RESERVED_NAME_RE.test(trimmed)
  ) {
    throw new StoreError(
      'INVALID_WORKSPACE_NAME',
      `Nome de projeto inválido: "${name}". Use 1 a 64 caracteres alfanuméricos, '.', '_', '-' ou espaço (sem '..', separadores ou nomes reservados).`,
      400,
    );
  }
  return trimmed;
}

/**
 * Fast Git branch detection by reading `<dir>/.git/HEAD` directly (no subprocess spawning).
 * Supports standard `.git/HEAD` directories as well as `.git` gitdir pointer files (worktrees/submodules).
 *
 * @param {string} dirPath
 * @returns {{ isGit: boolean, gitBranch: string | null }}
 */
export function readGitBranch(dirPath) {
  const dotGitPath = join(dirPath, '.git');
  if (!existsSync(dotGitPath)) {
    return { isGit: false, gitBranch: null };
  }

  let headPath = null;
  try {
    const stat = lstatSync(dotGitPath);
    if (stat.isDirectory()) {
      headPath = join(dotGitPath, 'HEAD');
    } else if (stat.isFile()) {
      // Git worktree or submodule pointer: `gitdir: <relative-or-abs-path>`
      const pointer = readFileSync(dotGitPath, 'utf8').trim();
      const match = /^gitdir:\s*(.+)$/i.exec(pointer);
      if (match && match[1]) {
        const gitDir = resolve(dirPath, match[1].trim());
        headPath = join(gitDir, 'HEAD');
      }
    } else {
      return { isGit: false, gitBranch: null };
    }
  } catch {
    return { isGit: false, gitBranch: null };
  }

  if (!headPath || !existsSync(headPath)) {
    return { isGit: true, gitBranch: null };
  }

  try {
    const headContent = readFileSync(headPath, 'utf8').trim();
    if (!headContent) return { isGit: true, gitBranch: null };
    if (headContent.startsWith('ref: refs/heads/')) {
      return {
        isGit: true,
        gitBranch: headContent.slice('ref: refs/heads/'.length).trim() || null,
      };
    }
    if (headContent.startsWith('ref: ')) {
      return {
        isGit: true,
        gitBranch: headContent.slice('ref: '.length).trim() || null,
      };
    }
    if (SHORT_SHA_RE.test(headContent)) {
      return {
        isGit: true,
        gitBranch: headContent.slice(0, 7),
      };
    }
    return { isGit: true, gitBranch: null };
  } catch {
    return { isGit: true, gitBranch: null };
  }
}

function countTasksFast(dirPath) {
  const tasksDir = join(dirPath, '.specs', 'tasks');
  if (!existsSync(tasksDir)) return 0;
  try {
    const entries = readdirSync(tasksDir);
    let count = 0;
    for (const file of entries) {
      if (!file.endsWith('.md')) continue;
      const id = file.slice(0, -3);
      if (TASK_ID_RE.test(id)) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

function detectHasHarness(dirPath) {
  try {
    return (
      existsSync(join(dirPath, '.specs')) ||
      existsSync(join(dirPath, 'AGENTS.md')) ||
      existsSync(join(dirPath, 'CLAUDE.md')) ||
      existsSync(join(dirPath, '.claude'))
    );
  } catch {
    return false;
  }
}

/**
 * Creates a multi-workspace manager with lazy cached stores and runners per workspace.
 *
 * @param {{
 *   primaryRootDir: string,
 *   workspacesDir?: string,
 *   sse?: { broadcast: (event: string, data: unknown) => void } | null,
 *   onRunUpdate?: (run: object, ctx: object) => void,
 *   mockStepDelayMs?: number,
 * }} options
 */
export function createWorkspaceManager(options = {}) {
  if (!options || !options.primaryRootDir) {
    throw new Error('createWorkspaceManager requires primaryRootDir');
  }

  const resolvedPrimary = resolve(options.primaryRootDir);
  const resolvedWorkspacesDir = options.workspacesDir
    ? resolve(options.workspacesDir)
    : dirname(resolvedPrimary);
  const primaryId = basename(resolvedPrimary);
  const primaryNorm = normalizeForCompare(resolvedPrimary);

  const sse = options.sse || null;
  const onRunUpdate = typeof options.onRunUpdate === 'function' ? options.onRunUpdate : null;
  const mockStepDelayMs = options.mockStepDelayMs ?? 200;

  let activeId = primaryId;

  /** @type {Map<string, { id: string, name: string, path: string, store: any, runner: any }>} */
  const contexts = new Map();

  function getSafeRealBase() {
    try {
      return realpathSync(resolvedWorkspacesDir);
    } catch {
      return resolvedWorkspacesDir;
    }
  }

  function getActiveRunCount(id) {
    const ctx = contexts.get(id);
    if (!ctx) return 0;
    let count = 0;
    for (const run of ctx.runner.listRuns()) {
      if (run.status === 'running') count += 1;
    }
    return count;
  }

  function inspectWorkspace(id, dirPath) {
    const { isGit, gitBranch } = readGitBranch(dirPath);
    const hasHarness = detectHasHarness(dirPath);
    const taskCount = countTasksFast(dirPath);
    const activeRunCount = getActiveRunCount(id);
    const isPrimary = normalizeForCompare(dirPath) === primaryNorm;

    return {
      id,
      name: id,
      path: dirPath,
      isGit,
      gitBranch,
      hasHarness,
      taskCount,
      activeRunCount,
      isPrimary,
    };
  }

  function discoverWorkspaces() {
    const discovered = new Map();
    const realBase = getSafeRealBase();

    if (existsSync(resolvedWorkspacesDir)) {
      let entries = [];
      try {
        entries = readdirSync(resolvedWorkspacesDir, { withFileTypes: true });
      } catch {
        entries = [];
      }

      for (const entry of entries) {
        const name = entry.name;
        if (!name || name.startsWith('.')) continue;

        const candidatePath = resolve(resolvedWorkspacesDir, name);
        if (!isStrictChildPath(resolvedWorkspacesDir, candidatePath)) continue;

        try {
          const lstat = lstatSync(candidatePath);
          if (!lstat.isDirectory() && !lstat.isSymbolicLink()) continue;

          // Resolve symlinks / Windows junctions and enforce strict containment inside workspacesDir
          const realTarget = realpathSync(candidatePath);
          if (!isStrictChildPath(realBase, realTarget)) continue;

          const targetStat = statSync(realTarget);
          if (!targetStat.isDirectory()) continue;

          discovered.set(name, inspectWorkspace(name, candidatePath));
        } catch {
          // Skip unreadable or broken entries gracefully
        }
      }
    }

    // Ensure primaryRootDir is always available even if workspacesDir was overridden to a separate directory
    if (!discovered.has(primaryId) && existsSync(resolvedPrimary)) {
      discovered.set(primaryId, inspectWorkspace(primaryId, resolvedPrimary));
    }

    const workspaces = Array.from(discovered.values()).sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return { discovered, workspaces };
  }

  function getOrCreateContext(wsMeta) {
    const existing = contexts.get(wsMeta.id);
    if (existing) return existing;

    const store = createStore(wsMeta.path);
    const ctx = {
      id: wsMeta.id,
      name: wsMeta.name,
      path: wsMeta.path,
      store,
      runner: null,
    };

    ctx.runner = createRunner({
      rootDir: wsMeta.path,
      sse,
      maxConcurrentRuns: store.readBoard().config.maxConcurrentRuns || 2,
      lockManager: {
        acquireLock: store.acquireLock,
        releaseLock: store.releaseLock,
      },
      mockStepDelayMs,
      onRunUpdate(run) {
        if (onRunUpdate) {
          onRunUpdate(run, ctx);
        }
      },
    });

    contexts.set(wsMeta.id, ctx);
    return ctx;
  }

  function listWorkspaces() {
    const { workspaces } = discoverWorkspaces();
    return {
      workspacesDir: resolvedWorkspacesDir,
      activeId,
      workspaces,
    };
  }

  function getActiveWorkspace() {
    const { discovered } = discoverWorkspaces();
    const found = discovered.get(activeId);
    if (found) return found;
    return inspectWorkspace(primaryId, resolvedPrimary);
  }

  function getActiveContext() {
    const existing = contexts.get(activeId);
    if (existing) return existing;

    const ws = getActiveWorkspace();
    return getOrCreateContext(ws);
  }

  function selectWorkspace(id) {
    const safeId = validateWorkspaceId(id);

    // Explicit symlink escape check on direct candidate before falling back to 404
    const candidatePath = resolve(resolvedWorkspacesDir, safeId);
    if (!isStrictChildPath(resolvedWorkspacesDir, candidatePath)) {
      throw new StoreError(
        'PATH_TRAVERSAL',
        'Acesso fora do diretório de workspaces bloqueado.',
        403,
      );
    }

    if (existsSync(candidatePath) || (() => {
      try {
        lstatSync(candidatePath);
        return true;
      } catch {
        return false;
      }
    })()) {
      try {
        const lstat = lstatSync(candidatePath);
        if (lstat.isSymbolicLink() || lstat.isDirectory()) {
          const realBase = getSafeRealBase();
          const realTarget = realpathSync(candidatePath);
          if (!isStrictChildPath(realBase, realTarget)) {
            throw new StoreError(
              'PATH_TRAVERSAL',
              'Symlink apontando para fora do diretório de workspaces bloqueado.',
              403,
            );
          }
        }
      } catch (err) {
        if (err instanceof StoreError) throw err;
      }
    }

    const { discovered } = discoverWorkspaces();
    const target = discovered.get(safeId);
    if (!target) {
      throw new StoreError(
        'WORKSPACE_NOT_FOUND',
        `Workspace não encontrado em ${resolvedWorkspacesDir}: "${safeId}"`,
        404,
      );
    }

    activeId = target.id;
    const context = getOrCreateContext(target);
    const workspace = {
      ...target,
      activeRunCount: getActiveRunCount(target.id),
    };

    return { workspace, context };
  }

  function installHarnessIntoTarget(targetPath) {
    // 1. Copy .claude/ excluding local settings.json / settings.local.json
    const srcClaude = join(resolvedPrimary, '.claude');
    const dstClaude = join(targetPath, '.claude');
    if (existsSync(srcClaude)) {
      const blockedSettings = normalizeForCompare(join(srcClaude, 'settings.json'));
      const blockedLocalSettings = normalizeForCompare(join(srcClaude, 'settings.local.json'));
      cpSync(srcClaude, dstClaude, {
        recursive: true,
        force: true,
        filter(src) {
          const norm = normalizeForCompare(src);
          return norm !== blockedSettings && norm !== blockedLocalSettings;
        },
      });
    } else {
      mkdirSync(dstClaude, { recursive: true });
    }

    // 2. Copy AGENTS.md
    const srcAgents = join(resolvedPrimary, 'AGENTS.md');
    if (existsSync(srcAgents)) {
      cpSync(srcAgents, join(targetPath, 'AGENTS.md'), { force: true });
    }

    // 3. Copy CLAUDE.md (constitution only + clean # Project template)
    const srcClaudeMd = join(resolvedPrimary, 'CLAUDE.md');
    if (existsSync(srcClaudeMd)) {
      const raw = readFileSync(srcClaudeMd, 'utf8').replace(/\r\n/g, '\n');
      const head = raw.split(/^# Project[ \t]*$/m)[0].trimEnd();
      const nextClaudeMd = head ? `${head}\n\n${CLAUDE_PROJECT_TEMPLATE}` : CLAUDE_PROJECT_TEMPLATE;
      writeFileAtomic(join(targetPath, 'CLAUDE.md'), nextClaudeMd);
    }

    // 4. Copy scripts/
    const srcScripts = join(resolvedPrimary, 'scripts');
    const dstScripts = join(targetPath, 'scripts');
    if (existsSync(srcScripts)) {
      cpSync(srcScripts, dstScripts, {
        recursive: true,
        force: true,
        filter(src) {
          const base = basename(src);
          return base !== 'node_modules' && !base.endsWith('.tmp');
        },
      });
    } else {
      mkdirSync(dstScripts, { recursive: true });
    }

    // 5. Create clean .specs/ skeleton (never copying .specs/logs/* or existing tasks)
    for (const sub of ['tasks', 'docs', 'logs', 'harness']) {
      mkdirSync(join(targetPath, '.specs', sub), { recursive: true });
    }

    // 6. Ensure .gitignore includes harness ignore entries
    const gitignorePath = join(targetPath, '.gitignore');
    const existingLines = existsSync(gitignorePath)
      ? readFileSync(gitignorePath, 'utf8').replace(/\r\n/g, '\n').split('\n')
      : [];
    const nextLines = existingLines.filter((line, idx) => !(idx === existingLines.length - 1 && line === ''));
    for (const entry of HARNESS_GITIGNORE_ENTRIES) {
      if (!nextLines.includes(entry)) {
        nextLines.push(entry);
      }
    }
    writeFileAtomic(gitignorePath, `${nextLines.join('\n')}\n`);

    // 7. Sync Multi-AI adapters (Claude, Antigravity, Codex, Cursor)
    return syncAdapters(targetPath, { skipCliCheck: true });
  }

  /**
   * Creates a new project folder directly inside `workspacesDir` with optional
   * Git initialization, optional italac-harness installation + Multi-AI adapter sync,
   * and optional immediate workspace switch.
   *
   * @param {{
   *   name: string,
   *   initGit?: boolean,
   *   installHarness?: boolean,
   *   openAfterCreate?: boolean,
   * }} [createOptions]
   */
  function createWorkspace(createOptions = {}) {
    const safeName = validateNewWorkspaceName(createOptions?.name);
    const shouldInitGit = Boolean(createOptions?.initGit);
    const shouldInstallHarness = Boolean(createOptions?.installHarness);
    const shouldOpenAfterCreate = Boolean(createOptions?.openAfterCreate);

    mkdirSync(resolvedWorkspacesDir, { recursive: true });

    const targetPath = resolve(resolvedWorkspacesDir, safeName);
    if (
      !isStrictChildPath(resolvedWorkspacesDir, targetPath) ||
      normalizeForCompare(dirname(targetPath)) !== normalizeForCompare(resolvedWorkspacesDir)
    ) {
      throw new StoreError(
        'PATH_TRAVERSAL',
        'Caminho fora do diretório de workspaces bloqueado.',
        403,
      );
    }

    let alreadyExists = existsSync(targetPath);
    if (!alreadyExists) {
      try {
        lstatSync(targetPath);
        alreadyExists = true;
      } catch {
        alreadyExists = false;
      }
    }
    if (alreadyExists) {
      throw new StoreError(
        'WORKSPACE_EXISTS',
        `Já existe um workspace com o nome "${safeName}".`,
        409,
      );
    }

    try {
      mkdirSync(targetPath, { recursive: false });
    } catch (err) {
      if (err?.code === 'EEXIST') {
        throw new StoreError(
          'WORKSPACE_EXISTS',
          `Já existe um workspace com o nome "${safeName}".`,
          409,
        );
      }
      throw new StoreError(
        'WORKSPACE_CREATE_FAILED',
        `Não foi possível criar a pasta do projeto: ${err?.message || 'erro desconhecido'}`,
        500,
      );
    }

    const realBase = getSafeRealBase();
    const realTarget = realpathSync(targetPath);
    if (!isStrictChildPath(realBase, realTarget)) {
      throw new StoreError(
        'PATH_TRAVERSAL',
        'Caminho fora do diretório de workspaces bloqueado.',
        403,
      );
    }

    let initializedGit = false;
    let gitWarning = null;
    if (shouldInitGit) {
      try {
        execFileSync('git', ['init'], {
          cwd: targetPath,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          timeout: 10000,
        });
        initializedGit = true;
      } catch (err) {
        initializedGit = false;
        gitWarning =
          err?.code === 'ENOENT'
            ? 'Git não encontrado no PATH; pasta criada sem repositório Git.'
            : `Falha ao inicializar Git: ${err?.message || 'erro desconhecido'}`;
      }
    }

    let installedHarness = false;
    let adaptersSync = null;
    if (shouldInstallHarness) {
      adaptersSync = installHarnessIntoTarget(targetPath);
      installedHarness = true;
    }

    let workspace = inspectWorkspace(safeName, targetPath);
    let context = null;

    if (shouldOpenAfterCreate) {
      const selected = selectWorkspace(safeName);
      workspace = selected.workspace;
      context = selected.context;
    }

    return {
      workspace,
      context,
      installedHarness,
      initializedGit,
      ...(gitWarning ? { gitWarning } : {}),
      ...(adaptersSync ? { adaptersSync } : {}),
    };
  }

  function stopAll(reason = 'Servidor encerrado') {
    for (const ctx of contexts.values()) {
      try {
        ctx.runner.stopAll(reason);
      } catch {
        // ignore teardown errors
      }
    }
  }

  return {
    get activeId() {
      return activeId;
    },
    primaryRootDir: resolvedPrimary,
    workspacesDir: resolvedWorkspacesDir,
    listWorkspaces,
    getActiveWorkspace,
    getActiveContext,
    selectWorkspace,
    createWorkspace,
    stopAll,
  };
}
