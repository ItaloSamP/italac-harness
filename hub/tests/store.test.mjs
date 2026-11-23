import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStore, StoreError, validateTaskId } from '../lib/store.mjs';
import {
  PLANNING_LANES,
  validateTransition,
  getRequiredReviewers,
} from '../lib/state-machine.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const VALIDATE_TASK_SCRIPT = join(REPO_ROOT, 'scripts', 'validate-task.mjs');

function runRealValidator(taskFilePath) {
  const out = execFileSync(process.execPath, [VALIDATE_TASK_SCRIPT, taskFilePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out;
}

describe('Harness Hub S1 — Store, State Machine & Atomic Locks', () => {
  let tmpRoot;
  let store;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'harness-hub-s1-'));
    store = createStore(tmpRoot);
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  describe('Task creation & validate-task.mjs roundtrip', () => {
    it('creates a full task that passes real scripts/validate-task.mjs', () => {
      const task = store.createTask({
        title: 'Implementar cache de sessão',
        boardLane: 'planned',
        problem: 'Sessões expiram sem aviso após 30 minutos de inatividade.',
        proof: 'node --test hub/tests/store.test.mjs',
        acceptanceCriteria: ['Cache expira em 300s e renova TTL ao ler'],
        outOfScope: ['Persistência em Redis'],
        approach: 'Adicionar Map com TTL em hub/lib/store.mjs',
        files: ['hub/lib/store.mjs'],
        tier: 'T2',
        type: 'Feature',
        priority: 'P1',
        assignee: '@developer',
        reviewer: '@code-reviewer',
      });

      assert.equal(task.id, 'task-implementar-cache-de-sessao');
      assert.equal(task.status, 'PLANNING');
      assert.equal(task.valid, true);
      assert.equal(task.meta.boardLane, 'planned');
      assert.equal(task.meta.priority, 'P1');
      assert.equal(task.meta.assignee, '@developer');
      assert.deepEqual(task.files, ['hub/lib/store.mjs']);

      const absPath = join(tmpRoot, task.filePath);
      const out = runRealValidator(absPath);
      assert.match(out, /Task file: PASS \(0 errors/);
    });

    it('supports quickCreate inline with concrete defaults passing validate-task.mjs', () => {
      const task = store.createTask({
        title: 'Corrigir badge de prioridade',
        boardLane: 'to_fix',
        quickCreate: true,
        priority: 'P0',
        assignee: '@developer',
      });

      assert.equal(task.status, 'PLANNING');
      assert.equal(task.meta.boardLane, 'to_fix');
      assert.equal(task.meta.type, 'Bug');
      assert.equal(task.valid, true);

      const out = runRealValidator(join(tmpRoot, task.filePath));
      assert.match(out, /Task file: PASS \(0 errors/);
    });

    it('deduplicates identical titles without overwriting existing task files', () => {
      const first = store.createTask({ title: 'Mesmo Titulo', quickCreate: true });
      const second = store.createTask({ title: 'Mesmo Titulo', quickCreate: true });
      assert.equal(first.id, 'task-mesmo-titulo');
      assert.equal(second.id, 'task-mesmo-titulo-2');
      assert.equal(store.listTasks().length, 2);
    });

    it('preserves markdown untouched on metadata-only update and preserves comments on AC toggle', () => {
      const created = store.createTask({
        title: 'Lossless roundtrip test',
        acceptanceCriteria: ['Endpoint retorna 200 em menos de 100ms'],
        files: ['hub/server.mjs'],
      });
      const absPath = join(tmpRoot, created.filePath);
      const beforeMd = readFileSync(absPath, 'utf8');

      // Metadata-only update must NOT touch the markdown file (AC-05.6)
      const updated = store.updateTask(created.id, { priority: 'P0', order: 5 });
      assert.equal(updated.meta.priority, 'P0');
      assert.equal(readFileSync(absPath, 'utf8'), beforeMd);

      // Toggling AC to done without evidence must fail (AC-08.3)
      assert.throws(
        () => store.toggleAc(created.id, 0, { done: true, evidence: '' }),
        (err) => err instanceof StoreError && err.code === 'EVIDENCE_REQUIRED',
      );

      // Toggling AC to done with evidence succeeds and preserves comments
      const withAc = store.toggleAc(created.id, 0, {
        done: true,
        evidence: 'node --test hub/tests/store.test.mjs PASS',
      });
      assert.equal(withAc.acceptanceCriteria[0].done, true);
      assert.equal(withAc.acceptanceCriteria[0].evidence, 'node --test hub/tests/store.test.mjs PASS');
      const afterMd = readFileSync(absPath, 'utf8');
      assert.ok(afterMd.includes('<!-- Testable behaviours, not goals.'));
      assert.match(runRealValidator(absPath), /Task file: PASS \(0 errors/);
    });
  });

  describe('Dual-Board transitions & Harness Invariants (RN-01..08)', () => {
    it('allows free movement across all Planning lanes while keeping ## Status: PLANNING', () => {
      const task = store.createTask({
        title: 'Planejamento flexivel',
        boardLane: 'planned',
        quickCreate: true,
      });

      for (const lane of PLANNING_LANES) {
        const moved = store.moveTask(task.id, { toLane: lane });
        assert.equal(moved.status, 'PLANNING');
        assert.equal(moved.meta.boardLane, lane);
      }

      const out = runRealValidator(join(tmpRoot, task.filePath));
      assert.match(out, /Task file: PASS \(0 errors/);
    });

    it('completes full lifecycle PLANNING -> IN_PROGRESS -> IN_REVIEW -> READY_TO_COMMIT -> COMMITTED -> SHIPPED passing validator at every step', () => {
      const task = store.createTask({
        title: 'Fluxo completo',
        acceptanceCriteria: ['Retorna 200 OK com JSON valido'],
        files: ['hub/lib/example.mjs'],
        assignee: '@developer',
        reviewer: '@code-reviewer',
        tier: 'T2',
      });
      const absPath = join(tmpRoot, task.filePath);

      // PLANNING -> IN_PROGRESS
      let current = store.moveTask(task.id, { toLane: 'in_progress', actor: '@developer' });
      assert.equal(current.status, 'IN_PROGRESS');
      assert.equal(current.meta.boardLane, 'in_progress');
      assert.match(runRealValidator(absPath), /PASS \(0 errors/);

      // IN_PROGRESS -> IN_REVIEW
      current = store.moveTask(task.id, { toLane: 'in_review', actor: '@developer' });
      assert.equal(current.status, 'IN_REVIEW');
      assert.match(runRealValidator(absPath), /PASS \(0 errors/);

      // IN_REVIEW -> READY_TO_COMMIT must fail before AC evidence + reviewer approval
      assert.throws(
        () => store.moveTask(task.id, { toLane: 'ready', actor: 'user' }),
        (err) => err instanceof StoreError && err.code === 'INCOMPLETE_ACS',
      );

      // Complete AC with evidence, still missing reviewer approval
      store.toggleAc(task.id, 0, { done: true, evidence: 'test PASS' });
      assert.throws(
        () => store.moveTask(task.id, { toLane: 'ready', actor: 'user' }),
        (err) => err instanceof StoreError && err.code === 'MISSING_APPROVALS',
      );

      // Record @code-reviewer approval -> READY_TO_COMMIT succeeds
      store.updateTask(task.id, { reviewersApproved: ['@code-reviewer'] });
      current = store.moveTask(task.id, { toLane: 'ready', actor: '@code-reviewer' });
      assert.equal(current.status, 'READY_TO_COMMIT');
      assert.match(runRealValidator(absPath), /PASS \(0 errors/);

      // READY_TO_COMMIT -> COMMITTED rejected for non-@committer (RN-01 / RN-02)
      assert.throws(
        () => store.moveTask(task.id, { toStatus: 'COMMITTED', actor: 'user' }),
        (err) => err instanceof StoreError && err.code === 'COMMITTER_ONLY' && err.statusCode === 403,
      );
      assert.throws(
        () => store.moveTask(task.id, { toStatus: 'COMMITTED', actor: '@developer' }),
        (err) => err instanceof StoreError && err.code === 'COMMITTER_ONLY' && err.statusCode === 403,
      );

      // READY_TO_COMMIT -> COMMITTED allowed for @committer
      current = store.moveTask(task.id, { toStatus: 'COMMITTED', actor: '@committer' });
      assert.equal(current.status, 'COMMITTED');
      assert.equal(current.meta.boardLane, 'done');
      assert.match(runRealValidator(absPath), /PASS \(0 errors/);

      // COMMITTED -> SHIPPED requires Level C confirmation flag
      assert.throws(
        () => store.moveTask(task.id, { toStatus: 'SHIPPED', actor: 'user', confirmLevelC: false }),
        (err) => err instanceof StoreError && err.code === 'CONFIRM_LEVEL_C' && err.statusCode === 409,
      );

      current = store.moveTask(task.id, { toStatus: 'SHIPPED', actor: 'user', confirmLevelC: true });
      assert.equal(current.status, 'SHIPPED');
      assert.match(runRealValidator(absPath), /PASS \(0 errors/);

      // Terminal SHIPPED cannot move anywhere
      assert.throws(
        () => store.moveTask(task.id, { toStatus: 'PLANNING', actor: 'user' }),
        (err) => err instanceof StoreError && err.code === 'TERMINAL_STATUS',
      );
    });

    it('rejects forbidden matrix transitions (0 forbidden transitions accepted)', () => {
      const task = store.createTask({ title: 'Matriz estrita', quickCreate: true });
      const forbiddenFromPlanning = ['IN_REVIEW', 'READY_TO_COMMIT', 'COMMITTED', 'SHIPPED'];
      for (const target of forbiddenFromPlanning) {
        const res = validateTransition(task, { toStatus: target, actor: '@committer', confirmLevelC: true });
        assert.equal(res.ok, false, `PLANNING -> ${target} must be rejected`);
      }
    });

    it('enforces RN-03 author cannot review own T2+ work', () => {
      assert.throws(
        () =>
          store.createTask({
            title: 'Auto revisao proibida',
            quickCreate: true,
            tier: 'T2',
            assignee: '@developer',
            reviewer: '@developer',
          }),
        (err) => err instanceof StoreError && err.code === 'SELF_REVIEW_FORBIDDEN' && err.statusCode === 422,
      );

      // Also rejected when assignee tries to approve own T2 task in IN_REVIEW
      const task = store.createTask({
        title: 'Auto aprovacao proibida',
        acceptanceCriteria: ['Teste passa com 0 erros'],
        files: ['hub/lib/a.mjs'],
        tier: 'T2',
        assignee: '@developer',
      });
      store.moveTask(task.id, { toStatus: 'IN_PROGRESS', actor: '@developer' });
      store.moveTask(task.id, { toStatus: 'IN_REVIEW', actor: '@developer' });
      store.toggleAc(task.id, 0, { done: true, evidence: 'ok' });
      store.updateTask(task.id, { reviewersApproved: ['@developer', '@code-reviewer'] });

      assert.throws(
        () => store.moveTask(task.id, { toStatus: 'READY_TO_COMMIT', actor: '@developer' }),
        (err) => err instanceof StoreError && err.code === 'SELF_REVIEW_FORBIDDEN',
      );
    });

    it('enforces RN-04 Prototype cannot enter READY_TO_COMMIT without promotion', () => {
      const proto = store.createTask({
        title: 'Prototipo exploratorio',
        tier: 'Prototype',
        type: 'Prototype',
        acceptanceCriteria: ['Demonstracao funcional com 1 tela'],
        files: ['hub/lib/proto.mjs'],
        assignee: '@developer',
      });

      store.moveTask(proto.id, { toStatus: 'IN_PROGRESS', actor: '@developer' });
      store.moveTask(proto.id, { toStatus: 'IN_REVIEW', actor: '@developer' });
      store.toggleAc(proto.id, 0, { done: true, evidence: 'demo ok' });

      assert.throws(
        () => store.moveTask(proto.id, { toStatus: 'READY_TO_COMMIT', actor: 'user' }),
        (err) => err instanceof StoreError && err.code === 'PROTOTYPE_NOT_PROMOTED',
      );

      // Promote Prototype to T2, approve with @code-reviewer, then READY_TO_COMMIT succeeds
      const promoted = store.updateTask(proto.id, {
        tier: 'T2',
        reviewersApproved: ['@code-reviewer'],
      });
      assert.equal(promoted.meta.tier, 'T2');
      assert.ok(promoted.log.some((l) => l.includes('promovido')));

      const ready = store.moveTask(proto.id, { toStatus: 'READY_TO_COMMIT', actor: '@code-reviewer' });
      assert.equal(ready.status, 'READY_TO_COMMIT');
      assert.match(runRealValidator(join(tmpRoot, ready.filePath)), /PASS \(0 errors/);
    });

    it('supports BLOCKED(<prev>) and restores exact previous status on unblock', () => {
      const task = store.createTask({ title: 'Bloqueio e retorno', quickCreate: true });
      store.moveTask(task.id, { toStatus: 'IN_PROGRESS' });
      store.moveTask(task.id, { toStatus: 'IN_REVIEW' });

      const blocked = store.blockTask(task.id, {
        reason: 'Aguardando decisao de arquitetura',
        blockedNeedsUser: true,
      });
      assert.equal(blocked.status, 'BLOCKED');
      assert.equal(blocked.blockedFrom, 'IN_REVIEW');
      assert.equal(blocked.blockedReason, 'Aguardando decisao de arquitetura');
      assert.equal(blocked.meta.blockedNeedsUser, true);
      assert.match(runRealValidator(join(tmpRoot, blocked.filePath)), /PASS \(0 errors/);

      // Cannot unblock to a different status
      assert.throws(
        () => store.moveTask(task.id, { toStatus: 'PLANNING' }),
        (err) => err instanceof StoreError && err.code === 'INVALID_UNBLOCK',
      );

      // Unblock restores IN_REVIEW
      const resumed = store.unblockTask(task.id);
      assert.equal(resumed.status, 'IN_REVIEW');
      assert.equal(resumed.blockedFrom, null);
      assert.match(runRealValidator(join(tmpRoot, resumed.filePath)), /PASS \(0 errors/);
    });

    it('computes required reviewers per tier correctly', () => {
      assert.deepEqual(getRequiredReviewers({ tier: 'T2' }), ['@code-reviewer']);
      assert.deepEqual(getRequiredReviewers({ tier: 'T2', sensitiveSurface: true, userFacing: true }), [
        '@code-reviewer',
        '@security-auditor',
        '@qa-engineer',
      ]);
      assert.deepEqual(getRequiredReviewers({ tier: 'T3' }), [
        '@code-reviewer',
        '@security-auditor',
        '@qa-engineer',
      ]);
      assert.deepEqual(getRequiredReviewers({ tier: 'Prototype' }), []);
    });
  });

  describe('RN-05 File Overlap & Demand Queue', () => {
    it('rejects moving a second task to IN_PROGRESS when ## Files overlaps an active task', () => {
      const t1 = store.createTask({
        title: 'Tarefa A',
        quickCreate: true,
        files: ['hub/lib/shared.mjs', 'hub/lib/a.mjs'],
        assignee: '@developer',
      });
      const t2 = store.createTask({
        title: 'Tarefa B',
        quickCreate: true,
        files: ['./hub/lib/shared.mjs', 'hub/lib/b.mjs'],
        assignee: '@developer',
      });

      store.moveTask(t1.id, { toStatus: 'IN_PROGRESS', actor: '@developer' });

      assert.throws(
        () => store.moveTask(t2.id, { toStatus: 'IN_PROGRESS', actor: '@developer' }),
        (err) => err instanceof StoreError && err.code === 'FILE_CONFLICT' && err.statusCode === 409,
      );

      // Queue also reports t2 as ineligible due to file conflict
      const queue = store.getQueue({ agent: '@developer' });
      assert.equal(queue.eligible.length, 0);
      assert.equal(queue.ineligible.length, 1);
      assert.equal(queue.ineligible[0].taskId, t2.id);
      assert.match(queue.ineligible[0].reason, /Conflito de arquivos/);
    });
  });

  describe('Atomic Locks & Concurrent Claims (AC-10.3)', () => {
    it('guarantees exactly 1 winner out of 10 simultaneous claims on the same task', async () => {
      const task = store.createTask({
        title: 'Corrida de claim concorrente',
        quickCreate: true,
        files: ['hub/lib/race.mjs'],
        assignee: '@developer',
      });

      const attempts = Array.from({ length: 10 }, (_, idx) =>
        Promise.resolve().then(() => {
          try {
            const res = store.claimTask(task.id, {
              agent: '@developer',
              engine: `mock-${idx}`,
            });
            return { won: true, res };
          } catch (err) {
            return { won: false, code: err.code };
          }
        }),
      );

      const results = await Promise.all(attempts);
      const winners = results.filter((r) => r.won);
      const losers = results.filter((r) => !r.won);

      assert.equal(winners.length, 1, 'Expected exactly 1 claim winner');
      assert.equal(losers.length, 9, 'Expected exactly 9 claim rejections');
      assert.ok(
        losers.every((l) => l.code === 'ALREADY_CLAIMED' || l.code === 'NOT_CLAIMABLE'),
        `Unexpected loser codes: ${losers.map((l) => l.code).join(', ')}`,
      );

      const claimed = store.getTask(task.id);
      assert.equal(claimed.status, 'IN_PROGRESS');
      assert.ok(claimed.lock);

      // Releasing restores PLANNING and removes lock
      const released = store.releaseClaim(task.id, { agent: '@developer', reason: 'paused' });
      assert.equal(released.released, true);
      assert.equal(released.task.status, 'PLANNING');
      assert.equal(released.task.lock, null);
    });

    it('recovers stale TTL locks automatically', async () => {
      const task = store.createTask({ title: 'Lock expirado', quickCreate: true });
      const first = store.acquireLock(task.id, {
        agent: '@developer',
        engine: 'mock',
        ttlMs: 15,
      });
      assert.equal(first.ok, true);

      // Wait 40ms so TTL expires
      await new Promise((r) => setTimeout(r, 40));

      const second = store.acquireLock(task.id, {
        agent: '@qa-engineer',
        engine: 'claude',
      });
      assert.equal(second.ok, true);
      assert.equal(second.lock.agent, '@qa-engineer');
    });
  });

  describe('Optimistic Concurrency & Path Traversal Protection', () => {
    it('rejects stale expectedMtimeMs with 409 CONFLICT', () => {
      const task = store.createTask({ title: 'Conflito otimista', quickCreate: true });
      const absPath = join(tmpRoot, task.filePath);

      // Simulate external edit bumping mtime by +5 seconds
      const future = new Date(Date.now() + 5000);
      writeFileSync(absPath, readFileSync(absPath, 'utf8') + '\n', 'utf8');
      utimesSync(absPath, future, future);

      assert.throws(
        () => store.updateTask(task.id, { priority: 'P0' }, { expectedMtimeMs: task.mtimeMs }),
        (err) => err instanceof StoreError && err.code === 'CONFLICT' && err.statusCode === 409,
      );
    });

    it('rejects all path traversal and invalid task ID payloads', () => {
      const badIds = [
        '../secret',
        '..\\secret',
        'foo/bar',
        'foo\\bar',
        'task\0null',
        'UPPERCASE',
        '',
        '   ',
        '-leading-dash',
      ];
      for (const bad of badIds) {
        assert.throws(
          () => validateTaskId(bad),
          (err) => err instanceof StoreError && err.code === 'INVALID_TASK_ID' && err.statusCode === 400,
          `Expected "${bad}" to be rejected`,
        );
        assert.throws(
          () => store.getTask(bad),
          (err) => err instanceof StoreError && err.code === 'INVALID_TASK_ID',
        );
      }
    });
  });

  describe('Read-only repository readers (real workspace)', () => {
    it('reads 14 agents from AGENTS.md, incidents.jsonl, and gates from CLAUDE.md', () => {
      const repoStore = createStore(REPO_ROOT);

      const roster = repoStore.readRoster();
      assert.equal(roster.length, 14);
      const explorer = roster.find((a) => a.name === '@explorer');
      assert.ok(explorer);
      assert.equal(explorer.readOnly, true);
      assert.equal(explorer.fileExists, true);

      const incidents = repoStore.readIncidents();
      assert.ok(Array.isArray(incidents.open));
      assert.equal(incidents.total, incidents.open.length + incidents.fixedCount);
      assert.ok(incidents.fixedCount >= 20);

      const gates = repoStore.readGates();
      assert.ok(gates.some((g) => g.name === 'harness'));
      assert.ok(gates.some((g) => g.name === 'selftest'));
      const harnessGate = gates.find((g) => g.name === 'harness');
      assert.equal(harnessGate.status, 'pass');
      assert.equal(harnessGate.warnings, 1);
    });
  });
});
