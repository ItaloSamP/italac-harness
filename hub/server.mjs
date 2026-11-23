// Local HTTP + SSE server for Harness Hub.
// Strictly binds to 127.0.0.1 with DNS-rebinding protection, path-traversal protection,
// security headers, 1 MB JSON body limit, and full REST + SSE integration of S1/S2/S3.
// Zero dependencies — Node.js v24 native ESM.

import { execFile } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdaptersStatus, syncAdapters } from './lib/adapters.mjs';
import { createCalendarStore, validateEventId } from './lib/calendar.mjs';
import { fetchAssignedIssues, mapIssueToTaskInput } from './lib/github.mjs';
import { createSseHub } from './lib/sse.mjs';
import { READ_ONLY_AGENTS, TYPES } from './lib/state-machine.mjs';
import { StoreError, validateTaskId } from './lib/store.mjs';
import { createWorkspaceManager } from './lib/workspaces.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_PORT = 7331;
const ALLOWED_HOST = '127.0.0.1';
const ALLOWED_HOST_HEADER_RE = /^(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i;
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
const GATE_NAME_RE = /^[a-zA-Z0-9._ -]{1,60}$/;

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
});

const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
});

const ALLOWED_BUCKETS = new Set(['build', 'review', 'commit']);

function sendJson(res, statusCode, payload) {
  if (res.writableEnded || res.destroyed) return;
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  });
  res.end(body);
}

function sendError(res, err) {
  if (err instanceof StoreError || (err && typeof err.statusCode === 'number')) {
    const status = err.statusCode || 400;
    const payload = {
      error: err.code || 'ERROR',
      message: err.message || 'Erro ao processar requisição.',
    };
    if (err.details !== undefined) {
      payload.details = err.details;
      if (err.code === 'CONFLICT' && err.details && typeof err.details === 'object') {
        if (err.details.diskTask !== undefined) payload.diskTask = err.details.diskTask;
        if (err.details.currentMtimeMs !== undefined) payload.currentMtimeMs = err.details.currentMtimeMs;
      }
    } else if (err.holder !== undefined) {
      payload.details = { holder: err.holder };
    }
    sendJson(res, status, payload);
    return;
  }

  sendJson(res, 500, {
    error: 'INTERNAL_ERROR',
    message: 'Erro interno no servidor.',
  });
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      rejectBody(err);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        fail(
          new StoreError(
            'PAYLOAD_TOO_LARGE',
            'Corpo da requisição excede o limite de 1 MB.',
            413,
          ),
        );
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (chunks.length === 0) {
        resolveBody({});
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolveBody({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          rejectBody(
            new StoreError('INVALID_JSON', 'O corpo JSON deve ser um objeto.', 400),
          );
          return;
        }
        resolveBody(parsed);
      } catch {
        rejectBody(
          new StoreError('INVALID_JSON', 'JSON inválido no corpo da requisição.', 400),
        );
      }
    });

    req.on('error', (err) => {
      fail(new StoreError('REQUEST_ERROR', err?.message || 'Erro de leitura do corpo.', 400));
    });
  });
}

function execFileAsync(cmd, args, options) {
  return new Promise((resolveExec) => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      const exitCode = error
        ? typeof error.code === 'number'
          ? error.code
          : 1
        : 0;
      resolveExec({
        exitCode,
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? ''),
        timedOut: Boolean(error?.killed && error?.signal),
      });
    });
  });
}

function hasTraversalAttempt(rawUrlPath, decodedPath) {
  const candidates = [rawUrlPath, decodedPath];
  for (const p of candidates) {
    if (!p) continue;
    if (p.includes('\0') || p.includes('\\')) return true;
    const lowered = p.toLowerCase();
    if (lowered.includes('%2e') || lowered.includes('%5c') || lowered.includes('%00')) {
      return true;
    }
    const segments = p.split('/');
    if (segments.some((seg) => seg === '..')) return true;
  }
  return false;
}

/**
 * Creates a Harness Hub HTTP + SSE server bound strictly to 127.0.0.1.
 *
 * @param {{
 *   rootDir?: string,
 *   workspacesDir?: string,
 *   port?: number,
 *   host?: string,
 *   webDir?: string,
 *   githubFetchImpl?: typeof fetch,
 *   githubToken?: string | null,
 *   skipCliCheck?: boolean,
 *   mockStepDelayMs?: number,
 *   heartbeatMs?: number,
 * }} [options]
 */
export function createServer(options = {}) {
  const rootDir = resolve(options.rootDir || resolve(__dirname, '..'));
  const workspacesDir = options.workspacesDir
    ? resolve(options.workspacesDir)
    : dirname(rootDir);
  const webDir = resolve(options.webDir || resolve(__dirname, 'web'));
  const requestedHost = options.host ?? ALLOWED_HOST;
  if (requestedHost !== ALLOWED_HOST) {
    throw new Error(
      `Harness Hub must bind strictly to ${ALLOWED_HOST} (received "${requestedHost}")`,
    );
  }
  const requestedPort =
    options.port !== undefined && options.port !== null
      ? Number(options.port)
      : Number(process.env.PORT || DEFAULT_PORT);

  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error(`Invalid port: ${String(options.port)}`);
  }

  const skipCliCheck = Boolean(options.skipCliCheck);
  const githubFetchImpl = options.githubFetchImpl;
  const githubToken = options.githubToken;

  // Private Calendar stays anchored to primaryRootDir so personal/study/work events are shared across workspaces
  const calendar = createCalendarStore(rootDir);
  const sse = createSseHub({ heartbeatMs: options.heartbeatMs });

  let watcher = null;
  let watcherActive = false;
  let gateRunning = false;
  let boundPort = requestedPort;
  let started = false;

  const workspaceManager = createWorkspaceManager({
    primaryRootDir: rootDir,
    workspacesDir,
    sse,
    mockStepDelayMs: options.mockStepDelayMs ?? 200,
    onRunUpdate(run, ctx) {
      if (run.status === 'completed' || run.status === 'failed' || run.status === 'stopped') {
        try {
          ctx.store.recordActivity({
            actor: run.agent || 'system',
            engine: run.engine || null,
            type: `run_${run.status}`,
            taskId: run.taskId,
            message:
              run.status === 'completed'
                ? `Execução concluída (${run.engine})`
                : run.status === 'stopped'
                  ? `Execução interrompida (${run.engine})`
                  : `Execução falhou (${run.engine}): ${run.error || `exit ${run.exitCode}`}`,
          });
        } catch {
          // ignore activity write failure during teardown
        }
        sse.broadcast('state:changed', {
          reason: `run_${run.status}`,
          workspaceId: ctx.id,
          taskId: run.taskId,
          runId: run.runId,
        });
      }
    },
  });

  function attachWatcher(targetStore) {
    if (watcher) {
      try {
        watcher.close();
      } catch {
        // ignore close error
      }
      watcher = null;
    }
    watcherActive = false;
    if (!started) return;
    try {
      watcher = targetStore.watch(
        ({ reason }) => {
          sse.broadcast('state:changed', { reason });
        },
        (err) => {
          watcherActive = false;
          sse.broadcast('watcher:error', {
            message: err?.message || 'Erro no monitoramento de arquivos',
          });
        },
      );
      watcherActive = true;
    } catch {
      watcherActive = false;
    }
  }

  function getMergedConfig(activeStore = workspaceManager.getActiveContext().store) {
    const boardConfig = activeStore.readBoard().config;
    return {
      ...boardConfig,
      maxConcurrency: boardConfig.maxConcurrentRuns,
    };
  }

  function attachActiveRuns(tasks, activeRunner = workspaceManager.getActiveContext().runner) {
    const runningByTask = new Map();
    for (const run of activeRunner.listRuns()) {
      if (run.status === 'running') {
        runningByTask.set(run.taskId, run);
      }
    }
    return tasks.map((t) => ({
      ...t,
      activeRun: runningByTask.get(t.id) || null,
    }));
  }

  function enrichTask(task, activeRunner = workspaceManager.getActiveContext().runner) {
    if (!task) return null;
    const activeRun =
      activeRunner.listRuns().find((r) => r.taskId === task.id && r.status === 'running') || null;
    return { ...task, activeRun };
  }

  function buildFullState() {
    const ctx = workspaceManager.getActiveContext();
    const { store: activeStore, runner: activeRunner, path: activePath } = ctx;
    activeStore.cleanupStaleLocks();
    const base = activeStore.getState();
    const tasks = attachActiveRuns(base.tasks, activeRunner);
    const allRuns = activeRunner.listRuns();
    const activeRuns = allRuns.filter((r) => r.status === 'running');
    const adapters = getAdaptersStatus(activePath, { skipCliCheck });
    const config = {
      ...base.config,
      maxConcurrency: base.config.maxConcurrentRuns,
    };
    const wsList = workspaceManager.listWorkspaces();
    const activeWorkspace =
      wsList.workspaces.find((w) => w.id === ctx.id) || workspaceManager.getActiveWorkspace();

    return {
      ok: true,
      watching: watcherActive,
      repoRoot: base.repoRoot,
      workspace: activeWorkspace,
      workspaces: wsList.workspaces,
      workspacesDir: wsList.workspacesDir,
      config,
      tasks,
      queue: base.queue,
      roster: base.roster,
      agents: base.roster,
      gates: base.gates,
      incidents: base.incidents,
      adapters,
      activeRuns,
      runs: allRuns,
      activity: base.activity,
      meta: {
        version: 1,
        host: ALLOWED_HOST,
        port: boundPort,
        watching: watcherActive,
      },
    };
  }

  function serveStatic(req, res, rawPathname, decodedPath) {
    if (hasTraversalAttempt(rawPathname, decodedPath)) {
      sendJson(res, 403, {
        error: 'PATH_TRAVERSAL',
        message: 'Acesso fora do diretório hub/web bloqueado.',
      });
      return;
    }

    const rel = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    const absWeb = resolve(webDir);
    const absTarget = resolve(absWeb, rel);

    if (absTarget !== absWeb && !absTarget.startsWith(absWeb + sep)) {
      sendJson(res, 403, {
        error: 'PATH_TRAVERSAL',
        message: 'Acesso fora do diretório hub/web bloqueado.',
      });
      return;
    }

    if (!existsSync(absTarget)) {
      sendJson(res, 404, {
        error: 'NOT_FOUND',
        message: `Arquivo não encontrado: ${decodedPath}`,
      });
      return;
    }

    try {
      const lstat = lstatSync(absTarget);
      if (lstat.isDirectory()) {
        sendJson(res, 404, {
          error: 'NOT_FOUND',
          message: `Arquivo não encontrado: ${decodedPath}`,
        });
        return;
      }
      // Guard against symlinks pointing outside hub/web
      const realWeb = realpathSync(absWeb);
      const realTarget = realpathSync(absTarget);
      if (realTarget !== realWeb && !realTarget.startsWith(realWeb + sep)) {
        sendJson(res, 403, {
          error: 'PATH_TRAVERSAL',
          message: 'Acesso via symlink fora de hub/web bloqueado.',
        });
        return;
      }

      const ext = extname(absTarget).toLowerCase();
      const mime = MIME_TYPES[ext];
      if (!mime) {
        sendJson(res, 403, {
          error: 'UNSUPPORTED_MEDIA',
          message: 'Tipo de arquivo não permitido.',
        });
        return;
      }

      const content = readFileSync(absTarget);
      const stat = statSync(absTarget);
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Cache-Control': 'no-store, max-age=0',
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(content);
      }
    } catch {
      sendJson(res, 500, {
        error: 'STATIC_READ_ERROR',
        message: 'Erro ao ler arquivo estático.',
      });
    }
  }

  async function handleRequest(req, res) {
    // 1. DNS Rebinding protection
    const hostHeader = req.headers?.host;
    if (!hostHeader || !ALLOWED_HOST_HEADER_RE.test(hostHeader)) {
      sendJson(res, 403, {
        error: 'FORBIDDEN_HOST',
        message: 'Acesso negado: cabeçalho Host fora de 127.0.0.1 ou localhost.',
      });
      return;
    }

    const method = (req.method || 'GET').toUpperCase();
    const rawUrl = req.url || '/';
    const rawPathname = rawUrl.split('?')[0];

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl, `http://${ALLOWED_HOST}`);
    } catch {
      sendJson(res, 400, { error: 'INVALID_URL', message: 'URL inválida.' });
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(parsedUrl.pathname);
    } catch {
      sendJson(res, 400, { error: 'INVALID_URL', message: 'Codificação de URL inválida.' });
      return;
    }

    // 2. Non-API routes -> static files from hub/web/
    if (!pathname.startsWith('/api/')) {
      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' });
        return;
      }
      serveStatic(req, res, rawPathname, pathname);
      return;
    }

    // 3. SSE Stream
    if (method === 'GET' && pathname === '/api/events') {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      sse.addClient(req, res);
      return;
    }

    try {
      // ---- Multi-Workspace Discovery, Creation & Switching ----
      if (method === 'GET' && pathname === '/api/workspaces') {
        sendJson(res, 200, { ok: true, ...workspaceManager.listWorkspaces() });
        return;
      }

      if (method === 'POST' && pathname === '/api/workspaces') {
        const body = await readJsonBody(req);
        const openAfterCreate = body.openAfterCreate === true;
        const created = workspaceManager.createWorkspace({
          name: body.name,
          initGit: Boolean(body.initGit),
          installHarness: Boolean(body.installHarness),
          openAfterCreate,
        });

        if (openAfterCreate && created.context) {
          attachWatcher(created.context.store);
        }

        const state = buildFullState();
        const activeWs = state.workspace;

        sse.broadcast('workspace:changed', {
          id: activeWs.id,
          name: activeWs.name,
          path: activeWs.path,
          workspace: activeWs,
          createdWorkspace: created.workspace,
          opened: openAfterCreate,
        });
        sse.broadcast('state:changed', {
          reason: 'workspace_created',
          workspaceId: created.workspace.id,
        });

        sendJson(res, 201, {
          ok: true,
          workspace: created.workspace,
          installedHarness: created.installedHarness,
          initializedGit: created.initializedGit,
          ...(created.gitWarning ? { gitWarning: created.gitWarning } : {}),
          state,
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/workspaces/select') {
        const body = await readJsonBody(req);
        const { workspace, context } = workspaceManager.selectWorkspace(body.id);
        attachWatcher(context.store);
        const state = buildFullState();
        sse.broadcast('workspace:changed', {
          id: workspace.id,
          name: workspace.name,
          path: workspace.path,
          workspace,
        });
        sse.broadcast('state:changed', {
          reason: 'workspace_changed',
          workspaceId: workspace.id,
        });
        sendJson(res, 200, { ok: true, activeWorkspace: workspace, state });
        return;
      }

      // ---- State & Queue ----
      if (method === 'GET' && pathname === '/api/state') {
        sendJson(res, 200, buildFullState());
        return;
      }

      const { store, runner, path: activeRootDir } = workspaceManager.getActiveContext();

      if (method === 'GET' && pathname === '/api/queue') {
        store.cleanupStaleLocks();
        const agent = parsedUrl.searchParams.get('agent') || null;
        const today = parsedUrl.searchParams.get('today') || null;
        const bucket = parsedUrl.searchParams.get('bucket') || null;
        if (bucket && !ALLOWED_BUCKETS.has(bucket)) {
          throw new StoreError(
            'INVALID_BUCKET',
            `Bucket inválido: "${bucket}". Use build, review ou commit.`,
            400,
          );
        }
        const queue = store.getQueue({ agent, today });
        const result = bucket
          ? {
              eligible: queue.eligible.filter((i) => i.kind === bucket),
              ineligible: queue.ineligible.filter((i) => i.kind === bucket),
            }
          : queue;
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      // ---- Tasks Collection ----
      if (method === 'GET' && pathname === '/api/tasks') {
        store.cleanupStaleLocks();
        let tasks = attachActiveRuns(store.listTasks());
        const statusFilter = parsedUrl.searchParams.get('status');
        const laneFilter = parsedUrl.searchParams.get('lane');
        const assigneeFilter = parsedUrl.searchParams.get('assignee');
        if (statusFilter) tasks = tasks.filter((t) => t.status === statusFilter);
        if (laneFilter) tasks = tasks.filter((t) => t.meta?.boardLane === laneFilter);
        if (assigneeFilter) tasks = tasks.filter((t) => t.meta?.assignee === assigneeFilter);
        sendJson(res, 200, { ok: true, tasks });
        return;
      }

      if (method === 'POST' && pathname === '/api/tasks') {
        const body = await readJsonBody(req);
        const created = store.createTask(body);
        const task = enrichTask(created);
        sse.broadcast('state:changed', { reason: 'task_created', taskId: task.id });
        sendJson(res, 201, { ok: true, task });
        return;
      }

      // ---- Single Task & Actions ----
      const taskActionMatch = pathname.match(
        /^\/api\/tasks\/([^/]+)(?:\/(move|block|unblock|approve|claim|release|run))?$/,
      );
      if (taskActionMatch) {
        const taskId = taskActionMatch[1];
        const action = taskActionMatch[2] || null;
        validateTaskId(taskId);

        if (!action && method === 'GET') {
          const task = enrichTask(store.getTask(taskId));
          if (!task) {
            throw new StoreError('NOT_FOUND', `Tarefa não encontrada: ${taskId}`, 404);
          }
          sendJson(res, 200, { ok: true, task });
          return;
        }

        if (!action && method === 'PATCH') {
          const body = await readJsonBody(req);
          let updated;
          if (body.toggleAc && typeof body.toggleAc === 'object') {
            const idx = Number(body.toggleAc.index);
            if (!Number.isInteger(idx) || idx < 0) {
              throw new StoreError('INVALID_AC_INDEX', 'Índice de AC inválido.', 400);
            }
            updated = store.toggleAc(taskId, idx, {
              done: body.toggleAc.done,
              evidence: body.toggleAc.evidence,
              text: body.toggleAc.text,
              actor: body.actor || 'user',
              expectedMtimeMs: body.expectedMtimeMs,
            });
          } else {
            const patch =
              body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
                ? { ...body, ...body.meta }
                : body;
            updated = store.updateTask(taskId, patch, {
              actor: body.actor || 'user',
              expectedMtimeMs: body.expectedMtimeMs,
            });
          }
          const task = enrichTask(updated);
          sse.broadcast('state:changed', { reason: 'task_updated', taskId });
          sendJson(res, 200, { ok: true, task });
          return;
        }

        if (action === 'move' && method === 'POST') {
          const body = await readJsonBody(req);
          const moved = store.moveTask(taskId, body);
          const config = store.readBoard().config;
          let run = null;
          let autoRunError = null;

          const shouldAutoRun =
            moved.status === 'IN_PROGRESS' &&
            body.skipAutoRun !== true &&
            (body.autoRun ?? config.autoRunOnInProgress) === true;

          if (shouldAutoRun) {
            try {
              run = runner.startRun({
                task: moved,
                engine: body.engine || moved.meta?.aiEngine || config.defaultEngine || 'mock',
                mode: body.mode || config.defaultMode || 'impl',
                agent: body.agent || moved.meta?.assignee || '@developer',
                maxConcurrentRuns: config.maxConcurrentRuns || 2,
              });
            } catch (err) {
              autoRunError = {
                code: err.code || 'AUTO_RUN_FAILED',
                message: err.message || 'Não foi possível iniciar o Runner automaticamente.',
              };
            }
          }

          const task = enrichTask(store.getTask(taskId) || moved);
          sse.broadcast('state:changed', {
            reason: 'task_moved',
            taskId,
            status: task.status,
          });
          sendJson(res, 200, { ok: true, task, run, autoRunError });
          return;
        }

        if (action === 'block' && method === 'POST') {
          const body = await readJsonBody(req);
          const blocked = store.blockTask(taskId, body);
          const task = enrichTask(blocked);
          sse.broadcast('state:changed', { reason: 'task_blocked', taskId });
          sendJson(res, 200, { ok: true, task });
          return;
        }

        if (action === 'unblock' && method === 'POST') {
          const body = await readJsonBody(req);
          const unblocked = store.unblockTask(taskId, body);
          const task = enrichTask(unblocked);
          sse.broadcast('state:changed', { reason: 'task_unblocked', taskId });
          sendJson(res, 200, { ok: true, task });
          return;
        }

        if (action === 'approve' && method === 'POST') {
          const body = await readJsonBody(req);
          const reviewer = String(body.reviewer || body.agent || '').trim();
          if (!reviewer) {
            throw new StoreError('REVIEWER_REQUIRED', 'Informe o revisor para aprovar.', 400);
          }
          const existing = store.getTask(taskId);
          if (!existing) {
            throw new StoreError('NOT_FOUND', `Tarefa não encontrada: ${taskId}`, 404);
          }
          if (
            existing.meta?.tier !== 'Prototype' &&
            existing.meta?.assignee &&
            existing.meta.assignee === reviewer
          ) {
            throw new StoreError(
              'SELF_REVIEW_FORBIDDEN',
              'O autor não revisa o próprio trabalho T2+',
              422,
            );
          }
          const currentApproved = Array.isArray(existing.meta?.reviewersApproved)
            ? existing.meta.reviewersApproved
            : [];
          const nextApproved = [...new Set([...currentApproved, reviewer])];
          const updated = store.updateTask(
            taskId,
            { reviewersApproved: nextApproved },
            { actor: reviewer, expectedMtimeMs: body.expectedMtimeMs },
          );
          const task = enrichTask(updated);
          sse.broadcast('state:changed', { reason: 'task_approved', taskId });
          sendJson(res, 200, { ok: true, task });
          return;
        }

        if (action === 'claim' && method === 'POST') {
          const body = await readJsonBody(req);
          const config = store.readBoard().config;
          const result = store.claimTask(taskId, {
            agent: body.agent,
            engine: body.engine || body.ai || config.defaultEngine || 'mock',
            runId: body.runId || null,
            ttlMs: body.ttlMs || 0,
          });
          const task = enrichTask(result.task);
          sse.broadcast('state:changed', { reason: 'task_claimed', taskId });
          sendJson(res, 200, { ok: true, task, lock: result.lock });
          return;
        }

        if (action === 'release' && method === 'POST') {
          const body = await readJsonBody(req);
          const result = store.releaseClaim(taskId, {
            agent: body.agent || null,
            runId: body.runId || null,
            force: Boolean(body.force),
            reason: body.reason || null,
          });
          const task = enrichTask(result.task);
          sse.broadcast('state:changed', { reason: 'task_released', taskId });
          sendJson(res, 200, { ok: true, released: result.released, task });
          return;
        }

        if (action === 'run' && method === 'POST') {
          const body = await readJsonBody(req);
          const existing = store.getTask(taskId);
          if (!existing) {
            throw new StoreError('NOT_FOUND', `Tarefa não encontrada: ${taskId}`, 404);
          }
          const config = store.readBoard().config;
          const run = runner.startRun({
            task: existing,
            engine: body.engine || existing.meta?.aiEngine || config.defaultEngine || 'mock',
            mode: body.mode || config.defaultMode || 'impl',
            agent: body.agent || existing.meta?.assignee || '@developer',
            maxConcurrentRuns: config.maxConcurrentRuns || 2,
          });
          sse.broadcast('state:changed', {
            reason: 'run_started',
            taskId,
            runId: run.runId,
          });
          sendJson(res, 202, { ok: true, run });
          return;
        }
      }

      // ---- Runs ----
      if (method === 'GET' && pathname === '/api/runs') {
        sendJson(res, 200, { ok: true, runs: runner.listRuns() });
        return;
      }

      const runLogsMatch = pathname.match(/^\/api\/runs\/([^/]+)\/logs$/);
      if (method === 'GET' && runLogsMatch) {
        const runId = runLogsMatch[1];
        const logs = runner.getRunLogs(runId);
        if (!logs) {
          throw new StoreError('NOT_FOUND', `Execução não encontrada: ${runId}`, 404);
        }
        sendJson(res, 200, { ok: true, ...logs });
        return;
      }

      const runStopMatch = pathname.match(/^\/api\/runs\/([^/]+)\/stop$/);
      if (method === 'POST' && runStopMatch) {
        const runId = runStopMatch[1];
        const body = await readJsonBody(req);
        const result = runner.stopRun(runId, body.reason || 'Cancelado pelo usuário');
        if (!result.ok) {
          throw new StoreError('NOT_FOUND', `Execução não encontrada: ${runId}`, 404);
        }
        sse.broadcast('state:changed', { reason: 'run_stopped', runId });
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      // ---- GitHub ----
      if (method === 'GET' && pathname === '/api/github/issues') {
        const repo = parsedUrl.searchParams.get('repo') || null;
        const fetchOpts = { repo };
        if (githubFetchImpl) fetchOpts.fetchImpl = githubFetchImpl;
        if (githubToken !== undefined) fetchOpts.token = githubToken;
        const gh = await fetchAssignedIssues(fetchOpts);

        const existingTasks = store.listTasks();
        const importedMap = new Map();
        for (const t of existingTasks) {
          const gi = t.meta?.githubIssue;
          if (gi && gi.number) {
            const key = `${gi.repo || ''}#${gi.number}`;
            importedMap.set(key, t.id);
          }
        }

        const issues = (gh.issues || []).map((item) => {
          const key = `${item.repo || ''}#${item.number}`;
          const linkedTaskId = importedMap.get(key) || null;
          return {
            ...item,
            imported: Boolean(linkedTaskId),
            taskId: linkedTaskId,
          };
        });

        sendJson(res, 200, { ok: true, ...gh, issues });
        return;
      }

      if (method === 'POST' && pathname === '/api/github/import') {
        const body = await readJsonBody(req);
        const issue = body.issue && typeof body.issue === 'object' ? body.issue : body;
        const requestedLane = body.boardLane || undefined;
        const startInProgress = requestedLane === 'in_progress';

        const mapped = mapIssueToTaskInput(issue, {
          boardLane: startInProgress ? 'queued' : requestedLane,
          priority: body.priority,
          tier: body.tier,
          assignee: body.assignee,
          reviewer: body.reviewer,
          type: body.type,
        });

        // Prevent duplicate imports for same repo + issue number
        const existingTasks = store.listTasks();
        const duplicate = existingTasks.find((t) => {
          const gi = t.meta?.githubIssue;
          return (
            gi &&
            Number(gi.number) === Number(mapped.githubIssue.number) &&
            (gi.repo || '') === (mapped.githubIssue.repo || '')
          );
        });
        if (duplicate) {
          throw new StoreError(
            'ALREADY_IMPORTED',
            `Issue #${mapped.githubIssue.number} já importada como ${duplicate.id}`,
            409,
            { taskId: duplicate.id },
          );
        }

        // Normalize mapped fields to satisfy store invariants (TYPES & READ_ONLY_AGENTS)
        const safeType = TYPES.includes(mapped.type) ? mapped.type : 'Feature';
        const safeAssignee =
          mapped.assignee && !READ_ONLY_AGENTS.has(mapped.assignee)
            ? mapped.assignee
            : '@developer';
        const safeReviewer =
          mapped.reviewer && mapped.reviewer !== safeAssignee
            ? mapped.reviewer
            : '@code-reviewer';
        const idPrefix =
          mapped.githubIssue?.kind === 'pr_review'
            ? `task-gh-pr-${mapped.githubIssue.number}`
            : `task-gh-${mapped.githubIssue.number}`;

        let task = store.createTask({
          title: mapped.title,
          idPrefix,
          source: mapped.sourceDetail || mapped.source,
          boardLane: mapped.boardLane,
          priority: mapped.priority,
          tier: mapped.tier,
          type: safeType,
          assignee: safeAssignee,
          reviewer: safeReviewer,
          sensitiveSurface: mapped.sensitiveSurface,
          problem: mapped.problem,
          proof: mapped.proof,
          acceptanceCriteria: mapped.acceptanceCriteria,
          outOfScope: mapped.outOfScope,
          approach: mapped.approach,
          files: mapped.files,
          githubIssue: mapped.githubIssue,
          actor: body.actor || 'user',
        });

        let run = null;
        let autoRunError = null;
        if (startInProgress) {
          task = store.moveTask(task.id, {
            toLane: 'in_progress',
            toStatus: 'IN_PROGRESS',
            actor: body.actor || 'user',
          });
          const config = store.readBoard().config;
          const shouldAutoRun =
            body.skipAutoRun !== true &&
            (body.autoRun ?? config.autoRunOnInProgress) === true;
          if (shouldAutoRun) {
            try {
              run = runner.startRun({
                task,
                engine: body.engine || task.meta?.aiEngine || config.defaultEngine || 'mock',
                mode: body.mode || config.defaultMode || 'impl',
                agent: body.agent || task.meta?.assignee || '@developer',
                maxConcurrentRuns: config.maxConcurrentRuns || 2,
              });
            } catch (err) {
              autoRunError = {
                code: err.code || 'AUTO_RUN_FAILED',
                message: err.message,
              };
            }
          }
        }

        const enriched = enrichTask(store.getTask(task.id) || task);
        sse.broadcast('state:changed', { reason: 'github_imported', taskId: enriched.id });
        sendJson(res, 201, { ok: true, task: enriched, run, autoRunError });
        return;
      }

      // ---- Multi-AI Adapters ----
      if (method === 'GET' && pathname === '/api/adapters/status') {
        const status = getAdaptersStatus(activeRootDir, { skipCliCheck });
        sendJson(res, 200, { ok: true, ...status });
        return;
      }

      if (method === 'POST' && pathname === '/api/adapters/sync') {
        const body = await readJsonBody(req);
        const result = syncAdapters(activeRootDir, {
          platforms: body.platforms,
          targets: body.targets,
          dryRun: Boolean(body.dryRun),
          confirmOverwrite: Boolean(body.confirmOverwrite),
          force: Boolean(body.force),
          skipCliCheck,
        });

        if (!result.ok && result.error === 'CONFIRM_OVERWRITE') {
          sendJson(res, 409, {
            error: 'CONFIRM_OVERWRITE',
            message: result.message,
            overwriteManual: result.overwriteManual,
            preview: result.preview,
            status: result.status,
          });
          return;
        }

        if (!body.dryRun) {
          sse.broadcast('adapter:updated', {
            inParityCount: result.status.inParityCount,
            total: result.status.total,
          });
          sse.broadcast('adapters:synced', {
            inParityCount: result.status.inParityCount,
            total: result.status.total,
            written: result.written,
          });
          sse.broadcast('state:changed', { reason: 'adapters_synced' });
        }

        sendJson(res, 200, result);
        return;
      }

      // ---- Quality Gates ----
      if (method === 'POST' && pathname === '/api/gates/run') {
        if (gateRunning) {
          throw new StoreError(
            'GATE_ALREADY_RUNNING',
            'Já existe uma execução de gate em andamento.',
            409,
          );
        }
        const body = await readJsonBody(req);
        const only = body.only ? String(body.only).trim() : null;
        if (only && !GATE_NAME_RE.test(only)) {
          throw new StoreError('INVALID_GATE_NAME', `Nome de gate inválido: "${only}"`, 400);
        }
        const gateScript = join(activeRootDir, 'scripts', 'gate.mjs');
        if (!existsSync(gateScript)) {
          throw new StoreError(
            'GATE_SCRIPT_NOT_FOUND',
            'scripts/gate.mjs não encontrado no repositório.',
            404,
          );
        }

        const timeoutSec = Math.min(Math.max(Number(body.timeout) || 300, 1), 300);
        const args = [gateScript, '--root', activeRootDir];
        if (only) args.push('--only', only);

        gateRunning = true;
        try {
          const execRes = await execFileAsync(process.execPath, args, {
            cwd: activeRootDir,
            shell: false,
            timeout: timeoutSec * 1000,
            maxBuffer: 2 * 1024 * 1024,
          });

          const gates = store.readGates();
          const finishedAt = new Date().toISOString();

          for (const g of gates) {
            if (!only || g.name === only) {
              sse.broadcast('gate:updated', {
                name: g.name,
                status: g.status,
                warnings: g.warnings,
                tail: g.tail,
                finishedAt,
              });
            }
          }
          sse.broadcast('gate:finished', {
            exitCode: execRes.exitCode,
            only,
            gates,
            finishedAt,
          });
          sse.broadcast('state:changed', { reason: 'gates_run' });

          sendJson(res, 200, {
            ok: execRes.exitCode === 0,
            exitCode: execRes.exitCode,
            stdout: execRes.stdout,
            stderr: execRes.stderr,
            timedOut: execRes.timedOut,
            gates,
          });
        } finally {
          gateRunning = false;
        }
        return;
      }

      // ---- Private Calendar & Planner ----
      if (method === 'GET' && pathname === '/api/calendar') {
        const workspace = parsedUrl.searchParams.get('workspace') || undefined;
        const month = parsedUrl.searchParams.get('month') || undefined;
        const from = parsedUrl.searchParams.get('from') || undefined;
        const to = parsedUrl.searchParams.get('to') || undefined;
        const today = parsedUrl.searchParams.get('today') || undefined;
        const result = calendar.listEvents({ workspace, month, from, to, today });
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      if (method === 'POST' && pathname === '/api/calendar') {
        const body = await readJsonBody(req);
        const event = calendar.createEvent(body);
        sse.broadcast('calendar:updated', {
          reason: 'event_created',
          eventId: event.id,
          event,
        });
        sendJson(res, 201, { ok: true, event });
        return;
      }

      const calendarMatch = pathname.match(/^\/api\/calendar\/([^/]+)(?:\/(promote))?$/);
      if (calendarMatch) {
        const eventId = calendarMatch[1];
        const action = calendarMatch[2] || null;
        validateEventId(eventId);

        if (!action && method === 'PATCH') {
          const body = await readJsonBody(req);
          const event = calendar.updateEvent(eventId, body);
          sse.broadcast('calendar:updated', {
            reason: 'event_updated',
            eventId: event.id,
            event,
          });
          sendJson(res, 200, { ok: true, event });
          return;
        }

        if (!action && method === 'DELETE') {
          const result = calendar.deleteEvent(eventId);
          sse.broadcast('calendar:updated', {
            reason: 'event_deleted',
            eventId,
          });
          sendJson(res, 200, { ok: true, ...result });
          return;
        }

        if (action === 'promote' && method === 'POST') {
          const body = await readJsonBody(req);
          const existing = calendar.getEvent(eventId);
          if (!existing) {
            throw new StoreError('NOT_FOUND', `Evento não encontrado: ${eventId}`, 404);
          }
          if (existing.linkedTaskId && store.getTask(existing.linkedTaskId)) {
            throw new StoreError(
              'ALREADY_PROMOTED',
              `Evento já promovido para a tarefa ${existing.linkedTaskId}`,
              409,
              { taskId: existing.linkedTaskId },
            );
          }

          const timeLabel = existing.startTime
            ? `${existing.startTime}${existing.endTime ? `-${existing.endTime}` : ''}`
            : '';
          const problemParts = [];
          if (existing.notes) problemParts.push(existing.notes);
          if (existing.subject) problemParts.push(`Matéria/Projeto: ${existing.subject}`);
          problemParts.push(
            `Calendário privado (${existing.workspace}/${existing.kind}) — ${existing.date}${timeLabel ? ` ${timeLabel}` : ''}`,
          );

          const taskTitle =
            typeof body.title === 'string' && body.title.trim() ? body.title.trim() : existing.title;
          const taskProblem =
            typeof body.problem === 'string' && body.problem.trim()
              ? body.problem.trim()
              : problemParts.join('\n');

          const created = store.createTask({
            title: taskTitle,
            problem: taskProblem,
            boardLane: body.boardLane || 'scheduled',
            priority:
              body.priority ||
              (existing.kind === 'deadline' || existing.kind === 'delivery' ? 'P1' : 'P2'),
            tier: body.tier || 'T2',
            type: body.type || 'Feature',
            assignee: body.assignee || '@developer',
            reviewer: body.reviewer || '@code-reviewer',
            source: `Calendário privado (${existing.workspace}/${existing.kind}) — ${existing.date}`,
            acceptanceCriteria:
              Array.isArray(body.acceptanceCriteria) && body.acceptanceCriteria.length > 0
                ? body.acceptanceCriteria
                : [`Entrega "${taskTitle}" concluída até ${existing.date} com evidência verificada`],
            quickCreate: true,
            schedule: {
              date: existing.date,
              startTime: existing.startTime,
              endTime: existing.endTime,
              workspace: existing.workspace,
              calendarEventId: existing.id,
            },
            actor: body.actor || 'user',
          });

          const updatedEvent = calendar.updateEvent(eventId, { linkedTaskId: created.id });
          const task = enrichTask(created);

          sse.broadcast('state:changed', {
            reason: 'calendar_promoted',
            taskId: task.id,
            eventId: updatedEvent.id,
          });
          sse.broadcast('calendar:updated', {
            reason: 'event_promoted',
            eventId: updatedEvent.id,
            taskId: task.id,
            event: updatedEvent,
          });

          sendJson(res, 201, { ok: true, event: updatedEvent, task });
          return;
        }
      }

      // ---- Config ----
      if (method === 'PATCH' && pathname === '/api/config') {
        const body = await readJsonBody(req);
        const storePatch = {};
        if (body.autoRunOnInProgress !== undefined) {
          storePatch.autoRunOnInProgress = body.autoRunOnInProgress;
        }
        if (body.maxConcurrentRuns !== undefined) {
          storePatch.maxConcurrentRuns = body.maxConcurrentRuns;
        } else if (body.maxConcurrency !== undefined) {
          storePatch.maxConcurrentRuns = body.maxConcurrency;
        }
        if (body.defaultEngine !== undefined) {
          storePatch.defaultEngine = body.defaultEngine;
        }
        if (body.defaultMode !== undefined) {
          storePatch.defaultMode = body.defaultMode;
        }
        if (body.theme !== undefined) {
          storePatch.theme = body.theme;
        }
        if (body.boardViewMode !== undefined) {
          storePatch.boardViewMode = body.boardViewMode;
        }

        if (Object.keys(storePatch).length > 0) {
          store.updateConfig(storePatch);
        }

        const config = getMergedConfig();
        sse.broadcast('state:changed', { reason: 'config_updated' });
        sendJson(res, 200, { ok: true, config });
        return;
      }

      // ---- Fallback 404 for unknown API routes ----
      sendJson(res, 404, {
        error: 'NOT_FOUND',
        message: `Endpoint não encontrado: ${method} ${pathname}`,
      });
    } catch (err) {
      sendError(res, err);
    }
  }

  const server = createHttpServer((req, res) => {
    handleRequest(req, res).catch((err) => sendError(res, err));
  });

  function start() {
    if (started) {
      return Promise.resolve({
        port: boundPort,
        host: ALLOWED_HOST,
        url: `http://${ALLOWED_HOST}:${boundPort}`,
      });
    }
    return new Promise((resolveStart, rejectStart) => {
      const onError = (err) => {
        server.off('listening', onListening);
        rejectStart(err);
      };
      const onListening = () => {
        server.off('error', onError);
        started = true;
        const addr = server.address();
        boundPort = typeof addr === 'object' && addr ? addr.port : requestedPort;

        attachWatcher(workspaceManager.getActiveContext().store);

        resolveStart({
          port: boundPort,
          host: ALLOWED_HOST,
          url: `http://${ALLOWED_HOST}:${boundPort}`,
        });
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(requestedPort, ALLOWED_HOST);
    });
  }

  function stop() {
    return new Promise((resolveStop) => {
      watcherActive = false;
      if (watcher) {
        try {
          watcher.close();
        } catch {
          // ignore
        }
        watcher = null;
      }
      workspaceManager.stopAll('Servidor encerrado');
      sse.closeAll();

      if (!started && !server.listening) {
        resolveStop();
        return;
      }
      started = false;
      server.close(() => resolveStop());
    });
  }

  return {
    server,
    start,
    stop,
    get port() {
      return boundPort;
    },
    get url() {
      return `http://${ALLOWED_HOST}:${boundPort}`;
    },
    get store() {
      return workspaceManager.getActiveContext().store;
    },
    get runner() {
      return workspaceManager.getActiveContext().runner;
    },
    calendar,
    workspaceManager,
    sse,
  };
}

// Allow direct execution: `node hub/server.mjs [--port 7331] [--root <path>] [--workspaces-dir <path>]`
const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === resolve(__filename);

if (isDirectRun) {
  let port;
  let rootDir;
  let workspacesDir;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) port = Number(argv[++i]);
    else if (argv[i] === '--root' && argv[i + 1]) rootDir = resolve(argv[++i]);
    else if (argv[i] === '--workspaces-dir' && argv[i + 1]) workspacesDir = resolve(argv[++i]);
  }
  const hub = createServer({ rootDir, workspacesDir, port });
  const info = await hub.start();
  console.log(`Harness Hub rodando em ${info.url} (root: ${resolve(rootDir || resolve(__dirname, '..'))})`);

  const shutdown = async () => {
    await hub.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
