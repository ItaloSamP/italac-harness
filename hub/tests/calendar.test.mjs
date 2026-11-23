import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CALENDAR_REL_PATH, createCalendarStore } from '../lib/calendar.mjs';
import { createServer } from '../server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'harness-hub-cal-'));
  mkdirSync(join(dir, '.specs', 'tasks'), { recursive: true });
  mkdirSync(join(dir, '.specs', 'hub'), { recursive: true });
  mkdirSync(join(dir, '.specs', 'logs'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(dir, 'web-fixture'), { recursive: true });

  writeFileSync(join(dir, 'CLAUDE.md'), '# Harness\n', 'utf8');
  writeFileSync(
    join(dir, 'AGENTS.md'),
    '# AGENTS\n\n## Roster\n\n| Agent | Role | Writes | Model |\n|---|---|---|---|\n| `@developer` | Dev | code | inherit |\n| `@code-reviewer` | Review | report | inherit |\n',
    'utf8',
  );
  writeFileSync(join(dir, 'web-fixture', 'index.html'), '<html></html>\n', 'utf8');
  return dir;
}

function httpJson({ port, method = 'GET', path = '/', body = null }) {
  return new Promise((resolveReq, rejectReq) => {
    const payload = body !== null ? JSON.stringify(body) : null;
    const headers = { Host: `127.0.0.1:${port}` };
    if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload, 'utf8');
    }

    const req = http.request(
      { hostname: '127.0.0.1', port, method, path, headers },
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
    if (payload !== null) req.write(payload);
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
              // raw
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
          waitFor(predicate, timeoutMs = 3000) {
            const existing = events.find(predicate);
            if (existing) return Promise.resolve(existing);
            return new Promise((resolveWait, rejectWait) => {
              const timer = setTimeout(() => {
                rejectWait(new Error(`Timed out waiting for SSE event (${timeoutMs}ms)`));
              }, timeoutMs);
              waiters.push({ predicate, resolve: resolveWait, timer });
            });
          },
          close() {
            req.destroy();
          },
        });
      },
    );
    req.on('error', rejectConn);
    req.end();
  });
}

describe('Private Calendar store (unit)', () => {
  let dir;
  let cal;

  before(() => {
    dir = createTempRepo();
    cal = createCalendarStore(dir);
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('verifies .gitignore excludes .specs/hub/private-calendar.json in the repository', () => {
    const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8');
    assert.match(gitignore, /^\.specs\/hub\/private-calendar\.json$/m);
  });

  it('returns empty list and zeroed summary before file exists', () => {
    const res = cal.listEvents({ today: '2026-11-23' });
    assert.deepEqual(res.events, []);
    assert.deepEqual(res.summary, {
      total: 0,
      upcomingDeadlines: 0,
      todayCount: 0,
      studyHoursWeek: 0,
    });
    assert.equal(res.storagePath, CALENDAR_REL_PATH);
    assert.equal(res.isGitignored, true);
  });

  it('creates events with defaults and writes atomically to .specs/hub/private-calendar.json', () => {
    const ev = cal.createEvent({
      title: 'Ir ao dentista',
      date: '2026-11-23',
      startTime: '14:00',
      endTime: '15:00',
    });

    assert.match(ev.id, /^cal-\d+-[a-f0-9]{8}$/);
    assert.equal(ev.workspace, 'personal');
    assert.equal(ev.kind, 'plan');
    assert.equal(ev.status, 'planned');
    assert.equal(ev.linkedTaskId, null);

    const diskPath = join(dir, '.specs', 'hub', 'private-calendar.json');
    assert.equal(existsSync(diskPath), true);
    const parsed = JSON.parse(readFileSync(diskPath, 'utf8'));
    assert.equal(parsed.events.length, 1);
    assert.equal(parsed.events[0].id, ev.id);
  });

  it('validates title, date, workspace, kind, and time range', () => {
    assert.throws(
      () => cal.createEvent({ title: '   ', date: '2026-11-23' }),
      (err) => err.code === 'INVALID_TITLE' && err.statusCode === 400,
    );
    assert.throws(
      () => cal.createEvent({ title: 'a'.repeat(141), date: '2026-11-23' }),
      (err) => err.code === 'INVALID_TITLE' && err.statusCode === 400,
    );
    assert.throws(
      () => cal.createEvent({ title: 'Bad date', date: '23/11/2026' }),
      (err) => err.code === 'INVALID_DATE' && err.statusCode === 400,
    );
    assert.throws(
      () => cal.createEvent({ title: 'Fake date', date: '2026-02-30' }),
      (err) => err.code === 'INVALID_DATE' && err.statusCode === 400,
    );
    assert.throws(
      () => cal.createEvent({ title: 'Bad ws', date: '2026-11-23', workspace: 'gaming' }),
      (err) => err.code === 'INVALID_WORKSPACE' && err.statusCode === 400,
    );
    assert.throws(
      () => cal.createEvent({ title: 'Bad kind', date: '2026-11-23', kind: 'party' }),
      (err) => err.code === 'INVALID_KIND' && err.statusCode === 400,
    );
    assert.throws(
      () =>
        cal.createEvent({
          title: 'Inverted time',
          date: '2026-11-23',
          startTime: '16:00',
          endTime: '14:00',
        }),
      (err) => err.code === 'INVALID_TIME_RANGE' && err.statusCode === 400,
    );
  });

  it('filters by workspace, month, from/to and computes summary metrics accurately', () => {
    // 2026-11-23 is Monday; week bounds are 2026-11-23 .. 2026-11-29
    cal.createEvent({
      title: 'Estudar Cálculo II',
      date: '2026-11-24',
      startTime: '19:00',
      endTime: '21:30',
      workspace: 'study',
      kind: 'study',
      subject: 'Cálculo II',
    });
    cal.createEvent({
      title: 'Revisão Algoritmos',
      date: '2026-11-26',
      startTime: '20:00',
      endTime: '21:00',
      workspace: 'study',
      kind: 'study',
      subject: 'Algoritmos',
    });
    cal.createEvent({
      title: 'Entregar relatório da sprint',
      date: '2026-11-30',
      workspace: 'work',
      kind: 'delivery',
      subject: 'Sprint 14',
    });
    cal.createEvent({
      title: 'Prova final BD',
      date: '2026-12-05',
      workspace: 'study',
      kind: 'deadline',
      subject: 'Banco de Dados',
    });

    const all = cal.listEvents({ today: '2026-11-23' });
    assert.equal(all.summary.total, 5);
    assert.equal(all.summary.todayCount, 1);
    assert.equal(all.summary.upcomingDeadlines, 2);
    assert.equal(all.summary.studyHoursWeek, 3.5);

    const studyOnly = cal.listEvents({ workspace: 'study', today: '2026-11-23' });
    assert.equal(studyOnly.events.length, 3);
    assert.ok(studyOnly.events.every((e) => e.workspace === 'study'));
    assert.equal(studyOnly.summary.studyHoursWeek, 3.5);
    assert.equal(studyOnly.summary.upcomingDeadlines, 1);

    const decOnly = cal.listEvents({ month: '2026-12', today: '2026-11-23' });
    assert.equal(decOnly.events.length, 1);
    assert.equal(decOnly.events[0].title, 'Prova final BD');

    const range = cal.listEvents({ from: '2026-11-24', to: '2026-11-30', today: '2026-11-23' });
    assert.equal(range.events.length, 3);
    assert.deepEqual(
      range.events.map((e) => e.date),
      ['2026-11-24', '2026-11-26', '2026-11-30'],
    );
  });

  it('updates and deletes events and rejects invalid or missing IDs', () => {
    const created = cal.createEvent({
      title: 'Reunião cliente',
      date: '2026-11-25',
      startTime: '10:00',
      endTime: '11:00',
      workspace: 'work',
      kind: 'plan',
    });

    const updated = cal.updateEvent(created.id, {
      status: 'done',
      date: '2026-11-26',
      notes: 'Confirmado por e-mail',
    });
    assert.equal(updated.status, 'done');
    assert.equal(updated.date, '2026-11-26');
    assert.equal(updated.notes, 'Confirmado por e-mail');

    const removed = cal.deleteEvent(created.id);
    assert.equal(removed.deleted, true);
    assert.equal(cal.getEvent(created.id), null);

    assert.throws(
      () => cal.updateEvent('cal-does-not-exist', { status: 'done' }),
      (err) => err.code === 'NOT_FOUND' && err.statusCode === 404,
    );
    assert.throws(
      () => cal.deleteEvent('../etc/passwd'),
      (err) => err.code === 'INVALID_EVENT_ID' && err.statusCode === 400,
    );
  });
});

describe('Private Calendar HTTP + SSE API', () => {
  let dir;
  let hub;
  let port;
  let sse;

  before(async () => {
    dir = createTempRepo();
    hub = createServer({
      rootDir: dir,
      port: 0,
      webDir: join(dir, 'web-fixture'),
      skipCliCheck: true,
      heartbeatMs: 30_000,
    });
    const info = await hub.start();
    port = info.port;
    sse = await connectSse(port);
    await sse.waitFor((e) => e.event === 'connected');
  });

  after(async () => {
    sse?.close();
    await hub?.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  it('handles GET, POST, PATCH, DELETE /api/calendar and broadcasts calendar:updated', async () => {
    // POST
    const createdRes = await httpJson({
      port,
      method: 'POST',
      path: '/api/calendar',
      body: {
        title: 'Entregar trabalho de Redes',
        date: '2026-11-28',
        startTime: '18:00',
        endTime: '20:00',
        workspace: 'study',
        kind: 'deadline',
        subject: 'Redes de Computadores',
        notes: 'Subir PDF no portal da faculdade',
      },
    });
    assert.equal(createdRes.status, 201);
    assert.equal(createdRes.json.ok, true);
    const eventId = createdRes.json.event.id;

    const sseCreated = await sse.waitFor(
      (e) => e.event === 'calendar:updated' && e.data?.reason === 'event_created' && e.data?.eventId === eventId,
    );
    assert.equal(sseCreated.data.event.workspace, 'study');

    // GET with query filters
    const listRes = await httpJson({
      port,
      method: 'GET',
      path: '/api/calendar?workspace=study&month=2026-11&today=2026-11-23',
    });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.json.ok, true);
    assert.equal(listRes.json.isGitignored, true);
    assert.equal(listRes.json.storagePath, '.specs/hub/private-calendar.json');
    assert.equal(listRes.json.events.length, 1);
    assert.equal(listRes.json.summary.upcomingDeadlines, 1);
    assert.equal(listRes.json.summary.studyHoursWeek, 2);

    // PATCH
    const patchRes = await httpJson({
      port,
      method: 'PATCH',
      path: `/api/calendar/${eventId}`,
      body: { status: 'done', notes: 'PDF enviado!' },
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.json.event.status, 'done');
    assert.equal(patchRes.json.event.notes, 'PDF enviado!');

    await sse.waitFor(
      (e) => e.event === 'calendar:updated' && e.data?.reason === 'event_updated' && e.data?.eventId === eventId,
    );

    // DELETE
    const delRes = await httpJson({
      port,
      method: 'DELETE',
      path: `/api/calendar/${eventId}`,
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.json.deleted, true);

    await sse.waitFor(
      (e) => e.event === 'calendar:updated' && e.data?.reason === 'event_deleted' && e.data?.eventId === eventId,
    );
  });

  it('POST /api/calendar/:id/promote creates a scheduled Kanban task, links event, and broadcasts SSE', async () => {
    const createRes = await httpJson({
      port,
      method: 'POST',
      path: '/api/calendar',
      body: {
        title: 'Entregar API de pagamentos semana que vem',
        date: '2026-11-30',
        startTime: '09:00',
        endTime: '12:00',
        workspace: 'work',
        kind: 'delivery',
        subject: 'Checkout v2',
        notes: 'Validar webhook e testes de integração',
      },
    });
    assert.equal(createRes.status, 201);
    const eventId = createRes.json.event.id;

    const promoteRes = await httpJson({
      port,
      method: 'POST',
      path: `/api/calendar/${eventId}/promote`,
      body: {},
    });
    assert.equal(promoteRes.status, 201);
    assert.equal(promoteRes.json.ok, true);
    assert.ok(promoteRes.json.task?.id);
    assert.equal(promoteRes.json.task.meta.boardLane, 'scheduled');
    assert.equal(promoteRes.json.task.meta.priority, 'P1');
    assert.equal(promoteRes.json.event.linkedTaskId, promoteRes.json.task.id);

    // Both state:changed and calendar:updated must have been broadcast
    await sse.waitFor(
      (e) =>
        e.event === 'state:changed' &&
        e.data?.reason === 'calendar_promoted' &&
        e.data?.taskId === promoteRes.json.task.id,
    );
    await sse.waitFor(
      (e) =>
        e.event === 'calendar:updated' &&
        e.data?.reason === 'event_promoted' &&
        e.data?.eventId === eventId,
    );

    // Verify task actually exists via GET /api/tasks/:id
    const taskRes = await httpJson({
      port,
      method: 'GET',
      path: `/api/tasks/${promoteRes.json.task.id}`,
    });
    assert.equal(taskRes.status, 200);
    assert.equal(taskRes.json.task.title, 'Entregar API de pagamentos semana que vem');

    // Promoting again must return 409 ALREADY_PROMOTED
    const dupRes = await httpJson({
      port,
      method: 'POST',
      path: `/api/calendar/${eventId}/promote`,
      body: {},
    });
    assert.equal(dupRes.status, 409);
    assert.equal(dupRes.json.error, 'ALREADY_PROMOTED');
  });

  it('returns 400 on invalid payloads and 404 on unknown events', async () => {
    const badPost = await httpJson({
      port,
      method: 'POST',
      path: '/api/calendar',
      body: { title: '', date: 'not-a-date' },
    });
    assert.equal(badPost.status, 400);

    const missingPatch = await httpJson({
      port,
      method: 'PATCH',
      path: '/api/calendar/cal-missing-123',
      body: { status: 'done' },
    });
    assert.equal(missingPatch.status, 404);

    const missingPromote = await httpJson({
      port,
      method: 'POST',
      path: '/api/calendar/cal-missing-123/promote',
      body: {},
    });
    assert.equal(missingPromote.status, 404);
  });
});
