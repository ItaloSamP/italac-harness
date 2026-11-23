import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createSseHub } from '../lib/sse.mjs';
import {
  buildEngineCommand,
  buildExecutionPrompt,
  createRunner,
  redactSecrets,
} from '../lib/runner.mjs';
import {
  fetchAssignedIssues,
  mapIssueToTaskInput,
  resolveGitHubToken,
} from '../lib/github.mjs';

const tempDirs = [];

function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'harness-hub-s3-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup issues on Windows
    }
  }
});

function createMockHttpPair() {
  const req = new EventEmitter();
  const res = new EventEmitter();
  res.headers = null;
  res.statusCode = null;
  res.chunks = [];
  res.writableEnded = false;
  res.destroyed = false;
  res.writeHead = (status, headers) => {
    res.statusCode = status;
    res.headers = headers;
  };
  res.flushHeaders = () => {};
  res.write = (chunk) => {
    res.chunks.push(String(chunk));
    return true;
  };
  res.end = () => {
    res.writableEnded = true;
    res.emit('close');
  };
  return { req, res };
}

function waitFor(predicate, timeoutMs = 3000, intervalMs = 15) {
  return new Promise((resolvePromise, rejectPromise) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolvePromise();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        rejectPromise(new Error(`Timed out after ${timeoutMs}ms`));
      }
    }, intervalMs);
  });
}

describe('SSE Hub (hub/lib/sse.mjs)', () => {
  it('registers clients, broadcasts events, sends heartbeat, and cleans up on disconnect', async () => {
    const hub = createSseHub({ heartbeatMs: 25 });
    const c1 = createMockHttpPair();
    const c2 = createMockHttpPair();

    hub.addClient(c1.req, c1.res);
    hub.addClient(c2.req, c2.res);

    assert.equal(hub.clientCount(), 2);
    assert.equal(c1.res.statusCode, 200);
    assert.equal(c1.res.headers['Content-Type'], 'text/event-stream; charset=utf-8');
    assert.match(c1.res.chunks[0], /^event: connected\ndata: /);

    const delivered = hub.broadcast('run:step', { runId: 'r1', step: 'Executando Slice' });
    assert.equal(delivered, 2);
    assert.ok(c1.res.chunks.some((c) => c.includes('event: run:step') && c.includes('Executando Slice')));
    assert.ok(c2.res.chunks.some((c) => c.includes('event: run:step')));

    // Wait for at least one heartbeat
    await waitFor(() => c1.res.chunks.some((c) => c === ':heartbeat\n\n'), 500);

    // Disconnect client 1
    c1.req.emit('close');
    assert.equal(hub.clientCount(), 1);

    const deliveredAfterDisconnect = hub.broadcast('state:changed', { reason: 'test' });
    assert.equal(deliveredAfterDisconnect, 1);

    hub.closeAll();
    assert.equal(hub.clientCount(), 0);
    assert.equal(c2.res.writableEnded, true);
  });
});

describe('Prompt Builder & Secret Redaction (hub/lib/runner.mjs)', () => {
  it('embeds all 4 parts of 80-prompt-amplifier.md, task fields, agent role, and guardrails', () => {
    const prompt = buildExecutionPrompt(
      {
        id: 'task-demo-auth',
        title: 'Corrigir renovação de sessão',
        problem: 'Sessões falham após 15 minutos.',
        proof: 'node --test tests/auth.test.mjs',
        acceptanceCriteria: [
          { text: 'Renovação idempotente com 0 falhas em 10 execuções', done: false },
        ],
        files: ['src/auth.mjs', 'tests/auth.test.mjs'],
        outOfScope: ['Alterar banco de dados'],
        approach: 'Adicionar mutex em memória por sessionId.',
      },
      { agent: '@developer', mode: 'impl', engine: 'mock' }
    );

    // All 4 parts of 80-prompt-amplifier.md
    assert.match(prompt, /Unasked expertise/i);
    assert.match(prompt, /Rawest material/i);
    assert.match(prompt, /Methods and tools/i);
    assert.match(prompt, /External proof/i);
    assert.match(prompt, /80-prompt-amplifier\.md/);

    // Task details and agent role
    assert.match(prompt, /Corrigir renovação de sessão/);
    assert.match(prompt, /Sessões falham após 15 minutos\./);
    assert.match(prompt, /src\/auth\.mjs/);
    assert.match(prompt, /@developer/);

    // Guardrails
    assert.match(prompt, /Level C/i);
    assert.match(prompt, /git push/i);
    assert.match(prompt, /Never run `git commit`/i);
  });

  it('redacts GitHub tokens, API keys, Bearer headers, and active GITHUB_TOKEN', () => {
    const fakeToken = 'ghp_1234567890abcdefghijklmnop';
    const fakePat = 'github_pat_1234567890abcdefghijklmnop';
    const fakeKey = 'sk-proj-1234567890abcdefghij';
    const raw = `Auth Bearer mysecrettoken12345 ${fakeToken} ${fakePat} ${fakeKey} custom=supersecret999`;

    const redacted = redactSecrets(raw, ['supersecret999']);
    assert.ok(!redacted.includes(fakeToken));
    assert.ok(!redacted.includes(fakePat));
    assert.ok(!redacted.includes(fakeKey));
    assert.ok(!redacted.includes('mysecrettoken12345'));
    assert.ok(!redacted.includes('supersecret999'));
    assert.match(redacted, /Bearer \[REDACTED\]/);
  });

  it('builds explicit argument arrays for all 4 real CLI adapters', () => {
    const claudeImpl = buildEngineCommand('claude', 'impl', 'hello');
    assert.equal(claudeImpl.binary, 'claude');
    assert.deepEqual(claudeImpl.args, ['-p', 'hello', '--output-format', 'text']);
    assert.deepEqual(claudeImpl.stripEnvKeys, ['CLAUDECODE']);

    const codexVerify = buildEngineCommand('codex', 'verify', 'hello');
    assert.equal(codexVerify.binary, 'codex');
    assert.deepEqual(codexVerify.args, ['exec', '--sandbox', 'read-only', 'hello']);

    const cursorImpl = buildEngineCommand('cursor', 'impl', 'hello');
    assert.equal(cursorImpl.binary, 'agent');
    assert.deepEqual(cursorImpl.args, ['-p', '--force', 'hello']);

    const agyVerify = buildEngineCommand('antigravity', 'verify', 'hello');
    assert.equal(agyVerify.binary, 'agy');
    assert.deepEqual(agyVerify.args, [
      '-p',
      'hello',
      '--mode',
      'plan',
      '--sandbox',
      '--output-format',
      'text',
    ]);
  });
});

describe('Auto-Execute Runner (hub/lib/runner.mjs)', () => {
  it('runs mock engine end-to-end, emits SSE steps/logs, writes log file, and releases lock', async () => {
    const rootDir = makeTempRoot();
    const events = [];
    const sse = {
      broadcast(event, data) {
        events.push({ event, data });
      },
    };

    const runner = createRunner({ rootDir, sse, mockStepDelayMs: 10 });

    const started = runner.startRun({
      task: {
        id: 'task-mock-e2e',
        title: 'Testar mock runner',
        problem: 'Validar ciclo completo.',
        proof: 'node --test',
        files: ['hub/lib/runner.mjs'],
        acceptanceCriteria: ['Fluxo completo com exit 0'],
      },
      engine: 'mock',
      agent: '@developer',
    });

    assert.equal(started.status, 'running');
    assert.equal(started.engine, 'mock');

    await waitFor(() => runner.getRun(started.runId)?.status === 'completed', 3000);

    const finished = runner.getRun(started.runId);
    assert.equal(finished.status, 'completed');
    assert.equal(finished.exitCode, 0);
    assert.equal(finished.progress, 100);

    // Check SSE event sequence
    const eventNames = events.map((e) => e.event);
    assert.equal(eventNames[0], 'run:started');
    assert.ok(eventNames.includes('run:step'));
    assert.ok(eventNames.includes('run:log'));
    assert.equal(eventNames[eventNames.length - 1], 'run:finished');

    const stepNames = events.filter((e) => e.event === 'run:step').map((e) => e.data.step);
    assert.deepEqual(stepNames, [
      'Amplificando Prompt',
      'Decompondo Tarefa',
      'Executando Slice',
      'Validando Gate',
    ]);

    // Check log file persisted on disk
    const absLog = resolve(rootDir, finished.logFile);
    assert.equal(existsSync(absLog), true);
    const logContent = readFileSync(absLog, 'utf8');
    assert.match(logContent, /80-prompt-amplifier\.md/);
    assert.match(logContent, /\[EXIT\] code=0/);

    // getRunLogs & listRuns
    const logs = runner.getRunLogs(started.runId);
    assert.ok(logs.lines.length >= 5);
    assert.equal(runner.listRuns().length, 1);

    // Lock must be released after completion
    const lockPath = resolve(rootDir, '.specs', 'hub', 'locks', 'task-mock-e2e.lock');
    assert.equal(existsSync(lockPath), false);
  });

  it('cancels an active mock run via stopRun, emits run:stopped, and releases lock', async () => {
    const rootDir = makeTempRoot();
    const events = [];
    const sse = {
      broadcast(event, data) {
        events.push({ event, data });
      },
    };

    const runner = createRunner({ rootDir, sse, mockStepDelayMs: 250 });

    const run = runner.startRun({
      task: { id: 'task-cancel-me', title: 'Tarefa cancelável' },
      engine: 'mock',
    });

    await waitFor(() => events.some((e) => e.event === 'run:step'), 1000);

    const stopRes = runner.stopRun(run.runId, 'Interrompido no teste');
    assert.equal(stopRes.ok, true);
    assert.equal(stopRes.run.status, 'stopped');

    assert.ok(events.some((e) => e.event === 'run:stopped' && e.data.runId === run.runId));

    const lockPath = resolve(rootDir, '.specs', 'hub', 'locks', 'task-cancel-me.lock');
    assert.equal(existsSync(lockPath), false);

    // Starting again after stop must succeed (lock released)
    const retry = runner.startRun({
      task: { id: 'task-cancel-me', title: 'Tarefa cancelável' },
      engine: 'mock',
    });
    assert.equal(retry.status, 'running');
    runner.stopAll();
  });

  it('enforces concurrency limits and rejects path traversal in taskId', () => {
    const rootDir = makeTempRoot();
    const runner = createRunner({ rootDir, maxConcurrentRuns: 1, mockStepDelayMs: 250 });

    assert.throws(
      () => runner.startRun({ task: { id: '../escape', title: 'Evil' } }),
      (err) => err.code === 'INVALID_TASK_ID'
    );

    const first = runner.startRun({ task: { id: 'task-one', title: 'One' }, engine: 'mock' });
    assert.equal(first.status, 'running');

    assert.throws(
      () => runner.startRun({ task: { id: 'task-one', title: 'One' }, engine: 'mock' }),
      (err) => err.code === 'ALREADY_RUNNING' && err.statusCode === 409
    );

    assert.throws(
      () => runner.startRun({ task: { id: 'task-two', title: 'Two' }, engine: 'mock' }),
      (err) => err.code === 'CONCURRENCY_LIMIT' && err.statusCode === 409
    );

    runner.stopAll();
  });

  it('spawns real CLI adapters strictly with shell: false and handles missing binary cleanly', async () => {
    const rootDir = makeTempRoot();
    const spawnCalls = [];

    function fakeSpawn(binary, args, opts) {
      spawnCalls.push({ binary, args, opts });
      const child = new EventEmitter();
      child.pid = undefined;
      child.stdin = { write() {}, end() {} };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(() => {
        const err = new Error(`spawn ${binary} ENOENT`);
        err.code = 'ENOENT';
        child.emit('error', err);
      });
      return child;
    }

    const runner = createRunner({ rootDir, spawnImpl: fakeSpawn });
    const run = runner.startRun({
      task: { id: 'task-cli-missing', title: 'CLI ausente' },
      engine: 'claude',
      mode: 'verify',
    });

    await waitFor(() => runner.getRun(run.runId)?.status === 'failed', 2000);

    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].binary, 'claude');
    assert.equal(spawnCalls[0].opts.shell, false);
    assert.ok(Array.isArray(spawnCalls[0].args));

    const failed = runner.getRun(run.runId);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.exitCode, 127);
    assert.match(failed.error, /não encontrada no PATH/i);

    const lockPath = resolve(rootDir, '.specs', 'hub', 'locks', 'task-cli-missing.lock');
    assert.equal(existsSync(lockPath), false);
  });
});

describe('GitHub Issues & PR Review Client (hub/lib/github.mjs)', () => {
  it('resolves token from env, falls back to gh CLI with shell: false, or returns none', () => {
    const fromEnv = resolveGitHubToken({
      env: { GITHUB_TOKEN: 'ghp_exampletoken1234567890' },
    });
    assert.equal(fromEnv.source, 'env');
    assert.equal(fromEnv.token, 'ghp_exampletoken1234567890');

    let calledWith = null;
    const fromCli = resolveGitHubToken({
      env: {},
      execFileSyncImpl: (cmd, args, opts) => {
        calledWith = { cmd, args, opts };
        return 'gho_clitoken1234567890\n';
      },
    });
    assert.equal(fromCli.source, 'gh-cli');
    assert.equal(fromCli.token, 'gho_clitoken1234567890');
    assert.equal(calledWith.cmd, 'gh');
    assert.deepEqual(calledWith.args, ['auth', 'token']);
    assert.equal(calledWith.opts.shell, false);

    const none = resolveGitHubToken({
      env: {},
      execFileSyncImpl: () => {
        throw new Error('gh not installed');
      },
    });
    assert.equal(none.source, 'none');
    assert.equal(none.token, null);
  });

  it('returns graceful demo fallback with issues and 2 PR review requests when unconfigured', async () => {
    const res = await fetchAssignedIssues({ token: null });
    assert.equal(res.configured, false);
    assert.equal(res.mode, 'demo');
    assert.ok(Array.isArray(res.issues));
    assert.ok(res.issues.length >= 5);

    const demoIssues = res.issues.filter((i) => i.kind === 'issue');
    const demoPrReviews = res.issues.filter((i) => i.kind === 'pr_review');
    assert.equal(demoIssues.length, 3);
    assert.equal(demoPrReviews.length, 2);
    assert.ok(res.issues.every((i) => i.demo === true));
  });

  it('fetches live assigned issues and review-requested PRs via mocked fetch without leaking token', async () => {
    const requestedUrls = [];
    const fakeToken = 'ghp_supersecretunittesttoken999';

    async function mockFetch(url, init) {
      requestedUrls.push({ url, auth: init.headers.Authorization });
      if (url.startsWith('https://api.github.com/issues')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return [
              {
                number: 42,
                title: 'Corrigir parser de logs',
                body: '- [ ] Parsear linhas UTF-8 sem perda',
                html_url: 'https://github.com/acme/hub/issues/42',
                repository: { full_name: 'acme/hub' },
                labels: [{ name: 'bug' }, { name: 'p1' }],
                state: 'open',
              },
              {
                number: 43,
                title: 'PR que não deve duplicar como issue',
                pull_request: { url: 'https://api.github.com/repos/acme/hub/pulls/43' },
                html_url: 'https://github.com/acme/hub/pull/43',
                labels: [],
                state: 'open',
              },
            ];
          },
        };
      }
      if (url.startsWith('https://api.github.com/search/issues')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              items: [
                {
                  number: 77,
                  title: 'Implementar cache de sessão',
                  body: 'Revisar `hub/lib/store.mjs`',
                  html_url: 'https://github.com/acme/hub/pull/77',
                  repository_url: 'https://api.github.com/repos/acme/hub',
                  labels: [{ name: 'review-requested' }],
                  state: 'open',
                },
              ],
            };
          },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    }

    const res = await fetchAssignedIssues({ token: fakeToken, fetchImpl: mockFetch });
    assert.equal(res.configured, true);
    assert.equal(res.mode, 'live');
    assert.equal(requestedUrls.length, 2);
    assert.equal(requestedUrls[0].auth, `Bearer ${fakeToken}`);
    assert.ok(requestedUrls[1].url.includes('review-requested:@me'));

    // Ensure PR #43 was filtered out of /issues and PR #77 was added as pr_review
    assert.equal(res.issues.length, 2);
    const issue = res.issues.find((i) => i.number === 42);
    const pr = res.issues.find((i) => i.number === 77);
    assert.equal(issue.kind, 'issue');
    assert.equal(issue.repo, 'acme/hub');
    assert.equal(pr.kind, 'pr_review');
    assert.equal(pr.repo, 'acme/hub');

    // Token must never appear in serialized response
    assert.ok(!JSON.stringify(res).includes(fakeToken));
  });

  it('handles 401 unauthorized, 403 rate limit, and offline network errors cleanly', async () => {
    const unauth = await fetchAssignedIssues({
      token: 'ghp_expiredtoken1234567890',
      fetchImpl: async () => ({ ok: false, status: 401, headers: new Headers() }),
    });
    assert.equal(unauth.mode, 'error');
    assert.equal(unauth.error, 'UNAUTHORIZED');

    const rateLimited = await fetchAssignedIssues({
      token: 'ghp_validtoken1234567890',
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        headers: new Headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1732400000' }),
      }),
    });
    assert.equal(rateLimited.mode, 'error');
    assert.equal(rateLimited.error, 'RATE_LIMITED');

    const offline = await fetchAssignedIssues({
      token: 'ghp_validtoken1234567890',
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });
    assert.equal(offline.mode, 'offline');
    assert.equal(offline.error, 'OFFLINE');
    assert.ok(offline.issues.length >= 5);
  });

  it('maps GitHub issues and PR review requests to valid task inputs (passing validate-task.mjs)', () => {
    const bugTask = mapIssueToTaskInput({
      number: 42,
      kind: 'issue',
      title: 'Corrigir crash no parser',
      body: 'Erro ao ler arquivo vazio.\n- [ ] Retornar lista vazia com exit 0\nArquivo: `hub/lib/store.mjs`',
      url: 'https://github.com/acme/hub/issues/42',
      repo: 'acme/hub',
      labels: ['bug', 'p1'],
    });

    assert.equal(bugTask.source, 'github');
    assert.equal(bugTask.agent, 'developer');
    assert.equal(bugTask.assignee, '@developer');
    assert.equal(bugTask.boardLane, 'to_fix');
    assert.equal(bugTask.priority, 'P1');
    assert.equal(bugTask.type, 'Bug');
    assert.deepEqual(bugTask.files, ['hub/lib/store.mjs']);
    assert.equal(bugTask.githubIssue.number, 42);
    assert.equal(bugTask.githubIssue.repo, 'acme/hub');
    assert.equal(bugTask.githubIssue.kind, 'issue');

    const prTask = mapIssueToTaskInput({
      number: 77,
      kind: 'pr_review',
      title: 'Refatorar locks atômicos',
      body: 'Altera `hub/lib/store.mjs` e `hub/tests/store.test.mjs`.',
      url: 'https://github.com/acme/hub/pull/77',
      repo: 'acme/hub',
      labels: ['review-requested'],
    });

    assert.equal(prTask.source, 'github');
    assert.equal(prTask.agent, 'code-reviewer');
    assert.equal(prTask.assignee, '@code-reviewer');
    assert.equal(prTask.boardLane, 'queued');
    assert.equal(prTask.type, 'Review');
    assert.equal(prTask.githubIssue.kind, 'pr_review');
    assert.match(prTask.problem, /Pull Request #77/);
    assert.ok(prTask.acceptanceCriteria.length >= 3);

    // Render mapped task into canonical Markdown and verify with real scripts/validate-task.mjs
    const tempRoot = makeTempRoot();
    const tasksDir = join(tempRoot, '.specs', 'tasks');
    mkdirSync(tasksDir, { recursive: true });
    const mdPath = join(tasksDir, `${bugTask.id}.md`);
    const markdown = [
      `# Task: ${bugTask.title}`,
      ``,
      `## Status: PLANNING`,
      ``,
      `## Source`,
      bugTask.sourceDetail,
      ``,
      `## Proof`,
      bugTask.proof,
      ``,
      `## Problem`,
      bugTask.problem,
      ``,
      `## Acceptance criteria`,
      ...bugTask.acceptanceCriteria.map((ac) => `- [ ] ${ac}`),
      ``,
      `## Out of scope`,
      ...bugTask.outOfScope.map((item) => `- ${item}`),
      ``,
      `## Approach`,
      bugTask.approach,
      ``,
      `## Files`,
      ...bugTask.files.map((f) => `- ${f}`),
      ``,
      `## Test scope`,
      `node --test`,
      ``,
    ].join('\n');
    writeFileSync(mdPath, markdown, 'utf8');

    const validator = resolve(process.cwd(), 'scripts', 'validate-task.mjs');
    const output = execFileSync(process.execPath, [validator, mdPath], {
      encoding: 'utf8',
      shell: false,
    });
    assert.match(output, /Task file: PASS/);
  });
});
