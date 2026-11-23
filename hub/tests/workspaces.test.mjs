import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  createWorkspaceManager,
  readGitBranch,
  validateWorkspaceId,
} from '../lib/workspaces.mjs';
import { createServer } from '../server.mjs';

function setupWorkspaceFixture() {
  const outer = mkdtempSync(join(tmpdir(), 'harness-ws-outer-'));
  const workspacesDir = join(outer, 'projects');
  const outsideDir = join(outer, 'secret-outside');
  mkdirSync(workspacesDir, { recursive: true });
  mkdirSync(outsideDir, { recursive: true });

  // Workspace 1: primary repo ("workflow") with harness + git branch main
  const wsPrimary = join(workspacesDir, 'workflow');
  mkdirSync(join(wsPrimary, '.git'), { recursive: true });
  mkdirSync(join(wsPrimary, '.specs', 'tasks'), { recursive: true });
  mkdirSync(join(wsPrimary, '.specs', 'hub'), { recursive: true });
  writeFileSync(join(wsPrimary, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8');
  writeFileSync(join(wsPrimary, 'CLAUDE.md'), '# Harness\n', 'utf8');
  writeFileSync(join(wsPrimary, 'AGENTS.md'), '# Agents\n', 'utf8');

  // Workspace 2: sibling project ("REQ-2026.2-T02-RedeCafuringa") with git branch feat/api, no harness yet
  const wsSibling = join(workspacesDir, 'REQ-2026.2-T02-RedeCafuringa');
  mkdirSync(join(wsSibling, '.git'), { recursive: true });
  writeFileSync(join(wsSibling, '.git', 'HEAD'), 'ref: refs/heads/feat/api\n', 'utf8');

  // Workspace 3: detached HEAD git repo
  const wsDetached = join(workspacesDir, 'detached-repo');
  mkdirSync(join(wsDetached, '.git'), { recursive: true });
  writeFileSync(
    join(wsDetached, '.git', 'HEAD'),
    'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678\n',
    'utf8',
  );

  // Workspace 4: plain non-git folder
  const wsPlain = join(workspacesDir, 'notes-plain');
  mkdirSync(wsPlain, { recursive: true });

  // Hidden dot-folder (must be excluded & blocked)
  mkdirSync(join(workspacesDir, '.hidden-folder'), { recursive: true });
  mkdirSync(join(workspacesDir, '.git'), { recursive: true });

  // Regular file inside workspacesDir (must be excluded)
  writeFileSync(join(workspacesDir, 'README.txt'), 'not a workspace\n', 'utf8');

  // Escaping symlink / junction pointing outside workspacesDir (must be excluded & blocked with 403)
  const escapingLink = join(workspacesDir, 'evil-escape');
  symlinkSync(outsideDir, escapingLink, process.platform === 'win32' ? 'junction' : 'dir');

  // Static web fixture
  const webDir = join(outer, 'web-fixture');
  mkdirSync(webDir, { recursive: true });
  writeFileSync(join(webDir, 'index.html'), '<!doctype html><html><body>Hub</body></html>\n', 'utf8');
  writeFileSync(join(webDir, 'styles.css'), 'body { color: #fff; }\n', 'utf8');

  return {
    outer,
    workspacesDir,
    outsideDir,
    wsPrimary,
    wsSibling,
    wsDetached,
    wsPlain,
    escapingLink,
    webDir,
  };
}

function apiRequest(port, method, path, body = null) {
  return new Promise((resolveReq, rejectReq) => {
    const payload = body !== null ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          Host: `127.0.0.1:${port}`,
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload, 'utf8'),
              }
            : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            // non-JSON response
          }
          resolveReq({
            status: res.statusCode,
            headers: res.headers,
            text: raw,
            json,
          });
        });
      },
    );
    req.on('error', rejectReq);
    if (payload) req.write(payload);
    req.end();
  });
}

function openSseCollector(port) {
  const events = [];
  let buffer = '';
  const req = http.get(
    {
      hostname: '127.0.0.1',
      port,
      path: '/api/events',
      headers: { Host: `127.0.0.1:${port}` },
    },
    (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buffer += chunk;
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          let eventName = 'message';
          let dataLine = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
          }
          if (dataLine) {
            try {
              events.push({ event: eventName, data: JSON.parse(dataLine) });
            } catch {
              events.push({ event: eventName, data: dataLine });
            }
          }
        }
      });
    },
  );
  req.on('error', () => {});
  return {
    events,
    close() {
      req.destroy();
    },
  };
}

async function waitFor(predicate, timeoutMs = 4000, intervalMs = 25) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

describe('hub/lib/workspaces.mjs — Unit Tests', () => {
  let fx;

  before(() => {
    fx = setupWorkspaceFixture();
  });

  after(() => {
    rmSync(fx.outer, { recursive: true, force: true });
  });

  it('readGitBranch parses branch refs, detached SHA, gitdir pointers, and non-git dirs', () => {
    assert.deepEqual(readGitBranch(fx.wsPrimary), { isGit: true, gitBranch: 'main' });
    assert.deepEqual(readGitBranch(fx.wsSibling), { isGit: true, gitBranch: 'feat/api' });
    assert.deepEqual(readGitBranch(fx.wsDetached), { isGit: true, gitBranch: 'a1b2c3d' });
    assert.deepEqual(readGitBranch(fx.wsPlain), { isGit: false, gitBranch: null });

    // Test gitdir file pointer (worktree/submodule style)
    const wtRepo = join(fx.outer, 'wt-repo');
    const actualGit = join(fx.outer, 'actual-git-dir');
    mkdirSync(wtRepo, { recursive: true });
    mkdirSync(actualGit, { recursive: true });
    writeFileSync(join(actualGit, 'HEAD'), 'ref: refs/heads/worktree-branch\n', 'utf8');
    writeFileSync(join(wtRepo, '.git'), `gitdir: ${actualGit}\n`, 'utf8');
    assert.deepEqual(readGitBranch(wtRepo), { isGit: true, gitBranch: 'worktree-branch' });
  });

  it('validateWorkspaceId accepts valid sibling folder names and rejects traversal / hidden folders', () => {
    assert.equal(validateWorkspaceId('workflow'), 'workflow');
    assert.equal(
      validateWorkspaceId('REQ-2026.2-T02-RedeCafuringa'),
      'REQ-2026.2-T02-RedeCafuringa',
    );
    assert.equal(validateWorkspaceId('my project_1'), 'my project_1');

    const badIds = ['', '   ', '.', '..', '../workflow', 'a/b', 'a\\b', '.git', '.hidden', 'a\0b'];
    for (const bad of badIds) {
      assert.throws(() => validateWorkspaceId(bad), { code: 'INVALID_WORKSPACE_ID' });
    }
  });

  it('discovers direct children, excludes hidden/files/escaping symlinks, and sorts primary first', () => {
    const mgr = createWorkspaceManager({
      primaryRootDir: fx.wsPrimary,
      workspacesDir: fx.workspacesDir,
    });

    const listed = mgr.listWorkspaces();
    assert.equal(listed.workspacesDir, fx.workspacesDir);
    assert.equal(listed.activeId, 'workflow');

    const ids = listed.workspaces.map((w) => w.id);
    assert.equal(ids[0], 'workflow', 'primary workspace should be first');
    assert.ok(ids.includes('REQ-2026.2-T02-RedeCafuringa'));
    assert.ok(ids.includes('detached-repo'));
    assert.ok(ids.includes('notes-plain'));
    assert.ok(!ids.includes('.hidden-folder'), 'hidden folders must be excluded');
    assert.ok(!ids.includes('.git'), '.git must be excluded');
    assert.ok(!ids.includes('README.txt'), 'files must be excluded');
    assert.ok(!ids.includes('evil-escape'), 'escaping symlinks/junctions must be excluded');

    const primaryMeta = listed.workspaces.find((w) => w.id === 'workflow');
    assert.equal(primaryMeta.isPrimary, true);
    assert.equal(primaryMeta.isGit, true);
    assert.equal(primaryMeta.gitBranch, 'main');
    assert.equal(primaryMeta.hasHarness, true);
    assert.equal(primaryMeta.taskCount, 0);
    assert.equal(primaryMeta.activeRunCount, 0);

    const siblingMeta = listed.workspaces.find((w) => w.id === 'REQ-2026.2-T02-RedeCafuringa');
    assert.equal(siblingMeta.isPrimary, false);
    assert.equal(siblingMeta.isGit, true);
    assert.equal(siblingMeta.gitBranch, 'feat/api');
    assert.equal(siblingMeta.hasHarness, false);
  });

  it('selectWorkspace enforces strict security and caches isolated contexts per workspace', () => {
    const mgr = createWorkspaceManager({
      primaryRootDir: fx.wsPrimary,
      workspacesDir: fx.workspacesDir,
    });

    assert.throws(() => mgr.selectWorkspace('../secret-outside'), {
      code: 'INVALID_WORKSPACE_ID',
    });
    assert.throws(() => mgr.selectWorkspace('.git'), { code: 'INVALID_WORKSPACE_ID' });
    assert.throws(() => mgr.selectWorkspace('evil-escape'), { code: 'PATH_TRAVERSAL' });
    assert.throws(() => mgr.selectWorkspace('does-not-exist'), { code: 'WORKSPACE_NOT_FOUND' });

    const ctxA1 = mgr.getActiveContext();
    assert.equal(ctxA1.id, 'workflow');

    const { workspace, context: ctxB } = mgr.selectWorkspace('REQ-2026.2-T02-RedeCafuringa');
    assert.equal(workspace.id, 'REQ-2026.2-T02-RedeCafuringa');
    assert.equal(ctxB.id, 'REQ-2026.2-T02-RedeCafuringa');
    assert.notEqual(ctxA1.store, ctxB.store);
    assert.notEqual(ctxA1.runner, ctxB.runner);

    // Switching back returns the exact same cached context instance
    const { context: ctxA2 } = mgr.selectWorkspace('workflow');
    assert.equal(ctxA2, ctxA1);
  });
});

describe('Multi-Workspace HTTP + SSE API & Isolation', () => {
  let fx;
  let hub;
  let port;

  before(async () => {
    fx = setupWorkspaceFixture();
    hub = createServer({
      rootDir: fx.wsPrimary,
      workspacesDir: fx.workspacesDir,
      webDir: fx.webDir,
      port: 0,
      skipCliCheck: true,
      mockStepDelayMs: 60,
      heartbeatMs: 60_000,
    });
    const info = await hub.start();
    port = info.port;
  });

  after(async () => {
    await hub.stop();
    rmSync(fx.outer, { recursive: true, force: true });
  });

  it('serves static assets with Cache-Control: no-store, max-age=0', async () => {
    const htmlRes = await apiRequest(port, 'GET', '/');
    assert.equal(htmlRes.status, 200);
    assert.equal(htmlRes.headers['cache-control'], 'no-store, max-age=0');

    const cssRes = await apiRequest(port, 'GET', '/styles.css');
    assert.equal(cssRes.status, 200);
    assert.equal(cssRes.headers['cache-control'], 'no-store, max-age=0');
  });

  it('GET /api/workspaces and GET /api/state expose active workspace and sibling list', async () => {
    const wsRes = await apiRequest(port, 'GET', '/api/workspaces');
    assert.equal(wsRes.status, 200);
    assert.equal(wsRes.json.ok, true);
    assert.equal(wsRes.json.activeId, 'workflow');
    assert.equal(wsRes.json.workspacesDir, fx.workspacesDir);
    assert.ok(wsRes.json.workspaces.some((w) => w.id === 'REQ-2026.2-T02-RedeCafuringa'));

    const stateRes = await apiRequest(port, 'GET', '/api/state');
    assert.equal(stateRes.status, 200);
    assert.equal(stateRes.json.workspace.id, 'workflow');
    assert.equal(stateRes.json.repoRoot, fx.wsPrimary);
    assert.ok(Array.isArray(stateRes.json.workspaces));
    assert.ok(stateRes.json.workspaces.length >= 4);
  });

  it('isolates tasks per workspace while sharing the global Private Calendar on primaryRootDir', async () => {
    const sse = openSseCollector(port);
    await new Promise((r) => setTimeout(r, 80));

    try {
      // 1. Create a task in primary workspace ("workflow")
      const taskARes = await apiRequest(port, 'POST', '/api/tasks', {
        title: 'Task exclusiva do Workflow',
        quickCreate: true,
      });
      assert.equal(taskARes.status, 201);
      const taskAId = taskARes.json.task.id;

      // 2. Create a global Private Calendar event
      const calCreate = await apiRequest(port, 'POST', '/api/calendar', {
        title: 'Revisar entrega T02',
        date: '2026-11-25',
        workspace: 'study',
        kind: 'deadline',
      });
      assert.equal(calCreate.status, 201);
      const calEventId = calCreate.json.event.id;

      // 3. Switch to sibling workspace ("REQ-2026.2-T02-RedeCafuringa")
      const switchRes = await apiRequest(port, 'POST', '/api/workspaces/select', {
        id: 'REQ-2026.2-T02-RedeCafuringa',
      });
      assert.equal(switchRes.status, 200);
      assert.equal(switchRes.json.ok, true);
      assert.equal(switchRes.json.activeWorkspace.id, 'REQ-2026.2-T02-RedeCafuringa');
      assert.equal(switchRes.json.state.workspace.id, 'REQ-2026.2-T02-RedeCafuringa');
      assert.equal(switchRes.json.state.repoRoot, fx.wsSibling);
      assert.equal(switchRes.json.state.tasks.length, 0, 'sibling workspace starts with 0 tasks');

      // Verify SSE broadcast for workspace:changed and state:changed
      const gotWsChanged = await waitFor(() =>
        sse.events.some(
          (e) =>
            e.event === 'workspace:changed' && e.data?.id === 'REQ-2026.2-T02-RedeCafuringa',
        ),
      );
      assert.equal(gotWsChanged, true, 'expected workspace:changed SSE event');

      // 4. Create a task in sibling workspace
      const taskBRes = await apiRequest(port, 'POST', '/api/tasks', {
        title: 'Task exclusiva da RedeCafuringa',
        quickCreate: true,
      });
      assert.equal(taskBRes.status, 201);
      const taskBId = taskBRes.json.task.id;
      assert.ok(existsSync(join(fx.wsSibling, '.specs', 'tasks', `${taskBId}.md`)));
      assert.ok(!existsSync(join(fx.wsPrimary, '.specs', 'tasks', `${taskBId}.md`)));

      // 5. Private Calendar must still return the global event from primaryRootDir
      const calList = await apiRequest(port, 'GET', '/api/calendar');
      assert.equal(calList.status, 200);
      assert.ok(
        calList.json.events.some((e) => e.id === calEventId),
        'global calendar event must remain visible after switching workspaces',
      );

      // 6. Switch back to workflow and verify task isolation
      const backRes = await apiRequest(port, 'POST', '/api/workspaces/select', {
        id: 'workflow',
      });
      assert.equal(backRes.status, 200);
      assert.equal(backRes.json.state.tasks.length, 1);
      assert.equal(backRes.json.state.tasks[0].id, taskAId);
    } finally {
      sse.close();
    }
  });

  it('keeps background runs alive in Workspace A after switching UI to Workspace B', async () => {
    // Ensure we are on workflow
    await apiRequest(port, 'POST', '/api/workspaces/select', { id: 'workflow' });

    const createRes = await apiRequest(port, 'POST', '/api/tasks', {
      title: 'Background Run Continuity Task',
      quickCreate: true,
    });
    assert.equal(createRes.status, 201);
    const taskId = createRes.json.task.id;

    // Start mock run in Workspace A (workflow)
    const runRes = await apiRequest(port, 'POST', `/api/tasks/${taskId}/run`, {
      engine: 'mock',
      mode: 'impl',
    });
    assert.equal(runRes.status, 202);
    const runId = runRes.json.run.runId;

    // Immediately switch to Workspace B while Workspace A is running
    const switchRes = await apiRequest(port, 'POST', '/api/workspaces/select', {
      id: 'REQ-2026.2-T02-RedeCafuringa',
    });
    assert.equal(switchRes.status, 200);
    assert.equal(switchRes.json.state.runs.length, 0, 'Workspace B has its own isolated runs');

    // Workspace A's run must finish cleanly in the background while Workspace B remains active
    const finishedInBg = await waitFor(() => {
      const wsList = hub.workspaceManager.listWorkspaces();
      const wfMeta = wsList.workspaces.find((w) => w.id === 'workflow');
      return wfMeta && wfMeta.activeRunCount === 0;
    }, 3000);
    assert.equal(finishedInBg, true, 'Workspace A run must complete in background');
    assert.equal(hub.workspaceManager.activeId, 'REQ-2026.2-T02-RedeCafuringa');

    // Switch back to Workspace A and confirm run completed with exitCode 0
    await apiRequest(port, 'POST', '/api/workspaces/select', { id: 'workflow' });
    const runsRes = await apiRequest(port, 'GET', '/api/runs');
    assert.equal(runsRes.status, 200);
    const finishedRun = runsRes.json.runs.find((r) => r.runId === runId);
    assert.ok(finishedRun, 'run record must be preserved in Workspace A');
    assert.equal(finishedRun.status, 'completed');
    assert.equal(finishedRun.exitCode, 0);
  });

  it('rejects traversal, hidden folders, unknown workspaces, and escaping symlinks via HTTP', async () => {
    const rTraversal = await apiRequest(port, 'POST', '/api/workspaces/select', {
      id: '../secret-outside',
    });
    assert.equal(rTraversal.status, 400);
    assert.equal(rTraversal.json.error, 'INVALID_WORKSPACE_ID');

    const rHidden = await apiRequest(port, 'POST', '/api/workspaces/select', {
      id: '.git',
    });
    assert.equal(rHidden.status, 400);
    assert.equal(rHidden.json.error, 'INVALID_WORKSPACE_ID');

    const rSymlink = await apiRequest(port, 'POST', '/api/workspaces/select', {
      id: 'evil-escape',
    });
    assert.equal(rSymlink.status, 403);
    assert.equal(rSymlink.json.error, 'PATH_TRAVERSAL');

    const rMissing = await apiRequest(port, 'POST', '/api/workspaces/select', {
      id: 'non-existent-project',
    });
    assert.equal(rMissing.status, 404);
    assert.equal(rMissing.json.error, 'WORKSPACE_NOT_FOUND');
  });
});
