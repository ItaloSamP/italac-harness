import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createStore } from '../lib/store.mjs';
import { createServer } from '../server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const HUB_CLI = join(REPO_ROOT, 'scripts', 'hub.mjs');

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'harness-hub-s4-'));

  mkdirSync(join(dir, '.claude', 'rules'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(dir, '.specs', 'tasks'), { recursive: true });
  mkdirSync(join(dir, '.specs', 'hub'), { recursive: true });
  mkdirSync(join(dir, '.specs', 'logs'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'web-fixture'), { recursive: true });

  writeFileSync(
    join(dir, 'CLAUDE.md'),
    [
      '# Harness Constitution',
      '',
      'Always verify with real commands.',
      '',
      '# Project',
      '',
      '## Verification',
      '',
      '| Gate | Command | Baseline |',
      '|---|---|---|',
      '| smoke | `node -e "console.log(\'PASS smoke\')"` | exit0 |',
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(
    join(dir, 'AGENTS.md'),
    [
      '# AGENTS',
      '',
      '## Roster',
      '',
      '| Agent | Role | Writes | Model |',
      '|---|---|---|---|',
      '| `@developer` | Implements tasks with tests | product code + tests | inherit |',
      '| `@code-reviewer` | Independent review | review report only | inherit |',
      '| `@qa-engineer` | Verifies ACs | test files | sonnet |',
      '| `@committer` | Commits and opens PRs | git history | sonnet |',
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(
    join(dir, '.claude', 'rules', '80-prompt-amplifier.md'),
    [
      '# Prompt Amplifier',
      '',
      '1. Unasked expertise',
      '2. Rawest material',
      '3. Methods and tools',
      '4. External proof',
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(
    join(dir, '.claude', 'agents', 'developer.md'),
    '---\nname: developer\ndescription: Implements slices with tests\nmodel: inherit\n---\n\nStay in scope.\n',
    'utf8',
  );

  // Copy real scripts/validate-task.mjs and scripts/gate.mjs so runner + gate tests exercise real scripts
  for (const scriptName of ['validate-task.mjs', 'gate.mjs']) {
    const src = join(REPO_ROOT, 'scripts', scriptName);
    if (existsSync(src)) {
      copyFileSync(src, join(dir, 'scripts', scriptName));
    }
  }

  // Self-contained static web fixture for deterministic static/traversal tests
  writeFileSync(
    join(dir, 'web-fixture', 'index.html'),
    '<!doctype html><html><head><title>Harness Hub</title></head><body><h1>Harness Hub</h1></body></html>\n',
    'utf8',
  );
  writeFileSync(
    join(dir, 'web-fixture', 'styles.css'),
    'body { background: #111; color: #eee; }\n',
    'utf8',
  );
  writeFileSync(join(dir, 'secret.txt'), 'TOP_SECRET_OUTSIDE_WEB\n', 'utf8');

  return dir;
}

function rawHttpRequest({ port, method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolveReq, rejectReq) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method,
        path,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            // non-JSON
          }
          resolveReq({ status: res.statusCode, headers: res.headers, text, json });
        });
      },
    );
    req.on('error', rejectReq);
    if (body !== null) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function connectSse(port) {
  return new Promise((resolveConn, rejectConn) => {
    const events = [];
    const waiters = [];
    let buffer = '';

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method: 'GET',
        path: '/api/events',
        headers: {
          Host: `127.0.0.1:${port}`,
          Accept: 'text/event-stream',
        },
      },
      (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            if (!frame.trim() || frame.startsWith(':')) continue;
            let eventName = 'message';
            const dataLines = [];
            for (const line of frame.split('\n')) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
            }
            let data = dataLines.join('\n');
            try {
              data = JSON.parse(data);
            } catch {
              // raw string
            }
            const evt = { event: eventName, data };
            events.push(evt);
            for (let i = waiters.length - 1; i >= 0; i--) {
              if (waiters[i].predicate(evt)) {
                const w = waiters.splice(i, 1)[0];
                clearTimeout(w.timer);
                w.resolve(evt);
              }
            }
          }
        });

        resolveConn({
          events,
          waitFor(predicate, timeoutMs = 5000) {
            const existing = events.find(predicate);
            if (existing) return Promise.resolve(existing);
            return new Promise((resWait, rejWait) => {
              const timer = setTimeout(() => {
                rejWait(new Error(`Timed out waiting for SSE event after ${timeoutMs}ms`));
              }, timeoutMs);
              waiters.push({ predicate, resolve: resWait, timer });
            });
          },
          close() {
            res.destroy();
            req.destroy();
          },
        });
      },
    );
    req.on('error', rejectConn);
    req.end();
  });
}

describe('Harness Hub Server (S4) & CLI E2E', () => {
  let tmpDir;
  let hub;
  let baseUrl;
  let port;

  before(async () => {
    tmpDir = createTempRepo();
    hub = createServer({
      rootDir: tmpDir,
      webDir: join(tmpDir, 'web-fixture'),
      port: 0,
      githubToken: null, // Force demo mode deterministically
      skipCliCheck: true,
      mockStepDelayMs: 25,
    });
    const info = await hub.start();
    baseUrl = info.url;
    port = info.port;
  });

  after(async () => {
    if (hub) await hub.stop();
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serves static index.html with security headers and blocks path traversal & bad Host', async () => {
    const home = await fetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type') || '', /text\/html/);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(home.headers.get('referrer-policy'), 'no-referrer');
    assert.match(home.headers.get('content-security-policy') || '', /default-src 'self'/);
    const html = await home.text();
    assert.match(html, /Harness Hub/);

    // Path traversal attempts must be rejected and never leak secret.txt
    for (const badPath of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%5csecret.txt']) {
      const res = await rawHttpRequest({
        port,
        path: badPath,
        headers: { Host: `127.0.0.1:${port}` },
      });
      assert.ok([400, 403, 404].includes(res.status), `Expected 400/403/404 for ${badPath}, got ${res.status}`);
      assert.doesNotMatch(res.text, /TOP_SECRET_OUTSIDE_WEB/);
    }

    // DNS rebinding Host header protection
    const evil = await rawHttpRequest({
      port,
      path: '/api/state',
      headers: { Host: 'evil.example:7331' },
    });
    assert.equal(evil.status, 403);
    assert.equal(evil.json?.error, 'FORBIDDEN_HOST');
  });

  it('GET /api/state returns full snapshot with all expected keys', async () => {
    const res = await fetch(`${baseUrl}/api/state`);
    assert.equal(res.status, 200);
    const state = await res.json();
    assert.equal(state.ok, true);
    assert.ok(Array.isArray(state.tasks));
    assert.ok(state.queue && Array.isArray(state.queue.eligible));
    assert.ok(Array.isArray(state.roster) && state.roster.length >= 4);
    assert.ok(Array.isArray(state.agents) && state.agents.length >= 4);
    assert.ok(state.incidents && Array.isArray(state.incidents.open));
    assert.ok(Array.isArray(state.gates) && state.gates.length === 1);
    assert.ok(state.adapters && state.adapters.total === 4);
    assert.ok(Array.isArray(state.runs));
    assert.ok(Array.isArray(state.activeRuns));
    assert.ok(state.config && state.config.autoRunOnInProgress === true);
    assert.ok(state.meta && state.meta.host === '127.0.0.1' && state.meta.port === port);
  });

  it('creates task, rejects invalid transition with 422, and triggers auto-run + SSE on move to in_progress', async () => {
    // 1. Create task
    const createRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Implementar cache local com TTL',
        boardLane: 'queued',
        priority: 'P1',
        tier: 'T2',
        assignee: '@developer',
        reviewer: '@code-reviewer',
        problem: 'Leituras repetidas de disco aumentam latência.',
        proof: 'node --test hub/tests/server.test.mjs',
        acceptanceCriteria: ['Cache expira em 60 segundos com 0 erros nos testes'],
        files: ['hub/server.mjs'],
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    const taskId = created.task.id;
    assert.ok(taskId.startsWith('task-'));
    assert.equal(created.task.status, 'PLANNING');

    // 2. Invalid transition PLANNING -> COMMITTED returns 422
    const badMove = await fetch(`${baseUrl}/api/tasks/${taskId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus: 'COMMITTED' }),
    });
    assert.equal(badMove.status, 422);
    const badMoveBody = await badMove.json();
    assert.equal(badMoveBody.error, 'INVALID_TRANSITION');

    // 3. Connect SSE stream and move to in_progress -> triggers mock auto-run
    const sse = await connectSse(port);
    try {
      await sse.waitFor((e) => e.event === 'connected');

      const moveRes = await fetch(`${baseUrl}/api/tasks/${taskId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toLane: 'in_progress', engine: 'mock' }),
      });
      assert.equal(moveRes.status, 200);
      const moved = await moveRes.json();
      assert.equal(moved.task.status, 'IN_PROGRESS');
      assert.ok(moved.run && moved.run.runId, 'Auto-run should have started');
      assert.equal(moved.autoRunError, null);

      const logEvt = await sse.waitFor(
        (e) => e.event === 'run:log' && e.data?.runId === moved.run.runId,
      );
      assert.equal(logEvt.data.taskId, taskId);

      const finishEvt = await sse.waitFor(
        (e) => e.event === 'run:finished' && e.data?.runId === moved.run.runId,
      );
      assert.equal(finishEvt.data.exitCode, 0);
      assert.equal(finishEvt.data.status, 'completed');

      // Verify /api/runs and /api/runs/:runId/logs
      const runsRes = await fetch(`${baseUrl}/api/runs`);
      assert.equal(runsRes.status, 200);
      const runsBody = await runsRes.json();
      assert.ok(runsBody.runs.some((r) => r.runId === moved.run.runId));

      const logsRes = await fetch(`${baseUrl}/api/runs/${moved.run.runId}/logs`);
      assert.equal(logsRes.status, 200);
      const logsBody = await logsRes.json();
      assert.ok(Array.isArray(logsBody.lines) && logsBody.lines.length >= 3);
    } finally {
      sse.close();
    }

    // 4. Block & Unblock roundtrip + Approve
    const blockRes = await fetch(`${baseUrl}/api/tasks/${taskId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Aguardando definição de TTL' }),
    });
    assert.equal(blockRes.status, 200);
    assert.equal((await blockRes.json()).task.status, 'BLOCKED');

    const unblockRes = await fetch(`${baseUrl}/api/tasks/${taskId}/unblock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(unblockRes.status, 200);
    assert.equal((await unblockRes.json()).task.status, 'IN_PROGRESS');

    const approveRes = await fetch(`${baseUrl}/api/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: '@code-reviewer' }),
    });
    assert.equal(approveRes.status, 200);
    const approved = await approveRes.json();
    assert.ok(approved.task.meta.reviewersApproved.includes('@code-reviewer'));
  });

  it('GET /api/github/issues returns demo fallback and POST /api/github/import creates task & blocks duplicates', async () => {
    const listRes = await fetch(`${baseUrl}/api/github/issues`);
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.mode, 'demo');
    assert.ok(listBody.issues.length >= 3);

    const regularIssue = listBody.issues.find((i) => i.kind === 'issue');
    const prReview = listBody.issues.find((i) => i.kind === 'pr_review');
    assert.ok(regularIssue && prReview);

    // Import regular issue
    const imp1 = await fetch(`${baseUrl}/api/github/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: regularIssue, boardLane: 'to_fix' }),
    });
    assert.equal(imp1.status, 201);
    const imp1Body = await imp1.json();
    assert.ok(imp1Body.task.id.startsWith(`task-gh-${regularIssue.number}-`));
    assert.equal(imp1Body.task.valid, true);

    // Duplicate import returns 409 ALREADY_IMPORTED
    const dup = await fetch(`${baseUrl}/api/github/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: regularIssue }),
    });
    assert.equal(dup.status, 409);
    assert.equal((await dup.json()).error, 'ALREADY_IMPORTED');

    // Import PR review item cleanly
    const impPr = await fetch(`${baseUrl}/api/github/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue: prReview }),
    });
    assert.equal(impPr.status, 201);
    const impPrBody = await impPr.json();
    assert.ok(impPrBody.task.id.startsWith(`task-gh-pr-${prReview.number}-`));
    assert.equal(impPrBody.task.valid, true);
  });

  it('GET /api/adapters/status and POST /api/adapters/sync bring all 4 platforms into parity', async () => {
    const beforeStatus = await (await fetch(`${baseUrl}/api/adapters/status`)).json();
    assert.equal(beforeStatus.total, 4);
    assert.equal(beforeStatus.inParityCount, 1);

    const dryRes = await fetch(`${baseUrl}/api/adapters/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    });
    assert.equal(dryRes.status, 200);
    const dryBody = await dryRes.json();
    assert.equal(dryBody.dryRun, true);
    assert.equal(dryBody.preview.create.length, 3);

    const syncRes = await fetch(`${baseUrl}/api/adapters/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(syncRes.status, 200);
    const syncBody = await syncRes.json();
    assert.equal(syncBody.ok, true);
    assert.equal(syncBody.status.inParityCount, 4);
  });

  it('POST /api/gates/run executes scripts/gate.mjs and PATCH /api/config updates preferences', async () => {
    const gateRes = await fetch(`${baseUrl}/api/gates/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ only: 'smoke' }),
    });
    assert.equal(gateRes.status, 200);
    const gateBody = await gateRes.json();
    assert.equal(gateBody.ok, true);
    assert.equal(gateBody.exitCode, 0);
    assert.match(gateBody.stdout, /PASS smoke/);

    const cfgRes = await fetch(`${baseUrl}/api/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        autoRunOnInProgress: false,
        defaultEngine: 'mock',
        maxConcurrency: 3,
        theme: 'light',
        boardViewMode: 'unified',
      }),
    });
    assert.equal(cfgRes.status, 200);
    const cfgBody = await cfgRes.json();
    assert.equal(cfgBody.config.autoRunOnInProgress, false);
    assert.equal(cfgBody.config.maxConcurrentRuns, 3);
    assert.equal(cfgBody.config.maxConcurrency, 3);
    assert.equal(cfgBody.config.theme, 'light');
    assert.equal(cfgBody.config.boardViewMode, 'unified');

    // Verify theme & boardViewMode persisted to board.json across fresh store.getState() calls
    const boardJson = JSON.parse(
      readFileSync(join(tmpDir, '.specs', 'hub', 'board.json'), 'utf8'),
    );
    assert.equal(boardJson.config.theme, 'light');
    assert.equal(boardJson.config.boardViewMode, 'unified');

    const freshStore = createStore(tmpDir);
    const freshState = freshStore.getState();
    assert.equal(freshState.config.theme, 'light');
    assert.equal(freshState.config.boardViewMode, 'unified');
  });

  it('PATCH /api/tasks/:id flattens nested meta payload and persists priority & schedule', async () => {
    const createRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Nested meta patch regression',
        quickCreate: true,
        boardLane: 'planned',
        priority: 'P2',
        assignee: '@developer',
        reviewer: '@code-reviewer',
        files: ['hub/nested-meta-test.mjs'],
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()).task;

    const patchRes = await fetch(`${baseUrl}/api/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedMtimeMs: created.mtimeMs,
        meta: {
          priority: 'P0',
          schedule: { day: '2026-11-23', destination: 'local_commit' },
        },
      }),
    });
    assert.equal(patchRes.status, 200);
    const patched = (await patchRes.json()).task;
    assert.equal(patched.meta.priority, 'P0');
    assert.equal(patched.meta.schedule?.day, '2026-11-23');
    assert.equal(patched.meta.schedule?.destination, 'local_commit');

    // Verify persistence via GET and a fresh store instance
    const getRes = await fetch(`${baseUrl}/api/tasks/${created.id}`);
    assert.equal(getRes.status, 200);
    const fetched = (await getRes.json()).task;
    assert.equal(fetched.meta.priority, 'P0');
    assert.equal(fetched.meta.schedule?.day, '2026-11-23');
    assert.equal(fetched.meta.schedule?.destination, 'local_commit');

    const freshTask = createStore(tmpDir).getTask(created.id);
    assert.equal(freshTask.meta.priority, 'P0');
    assert.equal(freshTask.meta.schedule?.day, '2026-11-23');
    assert.equal(freshTask.meta.schedule?.destination, 'local_commit');
  });

  it('GET /api/queue sorts queued lane ahead of planned and to_fix within the same priority', async () => {
    const createOne = async (title, boardLane, file) => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          quickCreate: true,
          boardLane,
          priority: 'P1',
          assignee: '@qa-engineer',
          reviewer: '@code-reviewer',
          files: [file],
        }),
      });
      assert.equal(res.status, 201);
      return (await res.json()).task.id;
    };

    const plannedId = await createOne('Queue sort planned', 'planned', 'hub/q-planned.mjs');
    const toFixId = await createOne('Queue sort to_fix', 'to_fix', 'hub/q-tofix.mjs');
    const queuedId = await createOne('Queue sort queued', 'queued', 'hub/q-queued.mjs');

    const qRes = await fetch(`${baseUrl}/api/queue?agent=${encodeURIComponent('@qa-engineer')}&bucket=build`);
    assert.equal(qRes.status, 200);
    const qBody = await qRes.json();
    const ids = qBody.eligible.map((i) => i.taskId);
    const qIdx = ids.indexOf(queuedId);
    const pIdx = ids.indexOf(plannedId);
    const fIdx = ids.indexOf(toFixId);
    assert.ok(qIdx >= 0 && pIdx >= 0 && fIdx >= 0, 'All three tasks should be eligible');
    assert.ok(qIdx < pIdx, `Expected queued (${qIdx}) before planned (${pIdx})`);
    assert.ok(qIdx < fIdx, `Expected queued (${qIdx}) before to_fix (${fIdx})`);
  });

  it('CLI scripts/hub.mjs supports --help, status, queue, claim, duplicate conflict (exit 2), release, and sync --check', async () => {
    // Create a clean PLANNING task for CLI queue/claim/release
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'CLI claim test task',
        quickCreate: true,
        boardLane: 'queued',
        assignee: '@developer',
        reviewer: '@code-reviewer',
        files: ['scripts/cli-only.mjs'],
      }),
    });
    assert.equal(res.status, 201);
    const cliTaskId = (await res.json()).task.id;

    // --help
    const helpOut = execFileSync(process.execPath, [HUB_CLI, '--help'], { encoding: 'utf8' });
    assert.match(helpOut, /Harness Hub CLI/);

    // status
    const statusOut = execFileSync(process.execPath, [HUB_CLI, 'status', '--root', tmpDir, '--json'], {
      encoding: 'utf8',
    });
    const statusJson = JSON.parse(statusOut);
    assert.ok(statusJson.tasksTotal >= 1);

    // queue --bucket build --json
    const queueOut = execFileSync(
      process.execPath,
      [HUB_CLI, 'queue', '--bucket', 'build', '--root', tmpDir, '--json'],
      { encoding: 'utf8' },
    );
    const queueJson = JSON.parse(queueOut);
    assert.ok(queueJson.eligible.some((i) => i.taskId === cliTaskId));

    // claim
    const claimOut = execFileSync(
      process.execPath,
      [HUB_CLI, 'claim', cliTaskId, '--agent', '@developer', '--ai', 'mock', '--root', tmpDir, '--json'],
      { encoding: 'utf8' },
    );
    const claimJson = JSON.parse(claimOut);
    assert.equal(claimJson.ok, true);
    assert.equal(claimJson.task.status, 'IN_PROGRESS');

    // Duplicate claim fails (task is now IN_PROGRESS / claimed)
    let dupStatus = 0;
    try {
      execFileSync(
        process.execPath,
        [HUB_CLI, 'claim', cliTaskId, '--agent', '@developer', '--ai', 'mock', '--root', tmpDir],
        { encoding: 'utf8', stdio: 'pipe' },
      );
    } catch (err) {
      dupStatus = err.status;
    }
    assert.ok(dupStatus === 1 || dupStatus === 2, `Expected non-zero exit code, got ${dupStatus}`);

    // release
    const relOut = execFileSync(
      process.execPath,
      [HUB_CLI, 'release', cliTaskId, '--agent', '@developer', '--root', tmpDir, '--json'],
      { encoding: 'utf8' },
    );
    const relJson = JSON.parse(relOut);
    assert.equal(relJson.ok, true);
    assert.equal(relJson.released, true);
    assert.equal(relJson.task.status, 'PLANNING');

    // sync --check (already synced in previous test -> exit 0)
    const syncOut = execFileSync(
      process.execPath,
      [HUB_CLI, 'sync', '--check', '--root', tmpDir, '--json'],
      { encoding: 'utf8' },
    );
    const syncJson = JSON.parse(syncOut);
    assert.equal(syncJson.ok, true);
  });
});
