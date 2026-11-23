import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  getAdaptersStatus,
  MANIFEST_REL_PATH,
  readCanonicalSources,
  readManifest,
  sha256,
  syncAdapters,
} from '../lib/adapters.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SYNC_CLI = join(REPO_ROOT, 'scripts', 'sync-adapters.mjs');

const tempDirs = [];

/**
 * Create an isolated temporary copy of the canonical harness sources.
 */
function createIsolatedRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'harness-adapters-test-'));
  tempDirs.push(dir);

  cpSync(join(REPO_ROOT, 'CLAUDE.md'), join(dir, 'CLAUDE.md'));
  cpSync(join(REPO_ROOT, 'AGENTS.md'), join(dir, 'AGENTS.md'));
  mkdirSync(join(dir, '.claude'), { recursive: true });
  cpSync(join(REPO_ROOT, '.claude', 'rules'), join(dir, '.claude', 'rules'), { recursive: true });
  cpSync(join(REPO_ROOT, '.claude', 'agents'), join(dir, '.claude', 'agents'), { recursive: true });

  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('hub/lib/adapters.mjs — Multi-AI Canonical Projections & Drift Checker', () => {
  it('reads canonical sources including 80-prompt-amplifier.md and reports initial missing projections', () => {
    const root = createIsolatedRepo();
    const canonical = readCanonicalSources(root);

    assert.equal(canonical.hasClaudeMd, true);
    assert.equal(canonical.hasAgentsMd, true);
    assert.equal(canonical.promptAmplifierIncluded, true);
    assert.ok(canonical.ruleCount >= 10, 'should load all .claude/rules/*.md files');
    assert.ok(canonical.agents.length >= 10, 'should load all .claude/agents/*.md files');
    assert.match(canonical.canonicalHash, /^[a-f0-9]{64}$/);

    const status = getAdaptersStatus(root, { skipCliCheck: true });
    assert.equal(status.total, 4);
    assert.equal(status.inParityCount, 1);
    assert.equal(status.promptAmplifierIncluded, true);
    assert.equal(status.includesPromptAmplifier, true);
    assert.equal(status.ruleCount, canonical.ruleCount);

    const byId = Object.fromEntries(status.platforms.map((p) => [p.id, p]));
    assert.equal(byId.claude.status, 'synced');
    assert.equal(byId.claude.targetPath, 'CLAUDE.md');
    assert.equal(byId.claude.promptAmplifierIncluded, true);

    assert.equal(byId.antigravity.status, 'missing');
    assert.equal(byId.antigravity.targetPath, '.gemini/rules/harness.md');
    assert.equal(byId.codex.status, 'missing');
    assert.equal(byId.codex.targetPath, '.agents/rules/harness.md');
    assert.equal(byId.cursor.status, 'missing');
    assert.equal(byId.cursor.targetPath, '.cursor/rules/harness.mdc');
  });

  it('supports dry-run preview without writing any files or manifest', () => {
    const root = createIsolatedRepo();
    const res = syncAdapters(root, { dryRun: true, skipCliCheck: true });

    assert.equal(res.ok, true);
    assert.equal(res.dryRun, true);
    assert.deepEqual(res.written, []);
    assert.deepEqual(res.preview.create, [
      '.gemini/rules/harness.md',
      '.agents/rules/harness.md',
      '.cursor/rules/harness.mdc',
    ]);
    assert.equal(existsSync(join(root, '.gemini/rules/harness.md')), false);
    assert.equal(existsSync(join(root, MANIFEST_REL_PATH)), false);
  });

  it('generates all 3 projections with exact 4-part Prompt Amplifier, Cursor frontmatter, roster, and Hub CLI', () => {
    const root = createIsolatedRepo();
    const amplifierText = readFileSync(join(root, '.claude/rules/80-prompt-amplifier.md'), 'utf8')
      .replace(/\r\n/g, '\n')
      .trim();

    const res = syncAdapters(root, { skipCliCheck: true });
    assert.equal(res.ok, true);
    assert.equal(res.written.length, 3);
    assert.equal(res.status.inParityCount, 4);
    assert.equal(res.status.total, 4);

    const targets = [
      { id: 'antigravity', path: '.gemini/rules/harness.md', engine: 'antigravity' },
      { id: 'codex', path: '.agents/rules/harness.md', engine: 'codex' },
      { id: 'cursor', path: '.cursor/rules/harness.mdc', engine: 'cursor' },
    ];

    for (const t of targets) {
      const abs = join(root, t.path);
      assert.equal(existsSync(abs), true, `${t.path} must exist`);
      const content = readFileSync(abs, 'utf8');

      // Exact 4-part Prompt Amplifier inclusion
      assert.ok(content.includes(amplifierText), `${t.path} must include 80-prompt-amplifier.md verbatim`);
      assert.ok(content.includes('1. **Unasked expertise**'), `${t.path} missing part 1`);
      assert.ok(content.includes('2. **Rawest material**'), `${t.path} missing part 2`);
      assert.ok(content.includes('3. **Methods and tools**'), `${t.path} missing part 3`);
      assert.ok(content.includes('4. **External proof**'), `${t.path} missing part 4`);

      // Roster, non-negotiables, and Hub queue CLI
      assert.ok(content.includes('## Roster'), `${t.path} missing roster`);
      assert.ok(content.includes('## Non-negotiables'), `${t.path} missing non-negotiables`);
      assert.ok(content.includes('node scripts/hub.mjs queue'), `${t.path} missing Hub queue CLI`);
      assert.ok(content.includes(`--engine ${t.engine}`), `${t.path} missing engine-specific claim command`);
      assert.ok(
        content.includes('<!-- GENERATED BY scripts/sync-adapters.mjs | canonical:'),
        `${t.path} missing generated header marker`,
      );
    }

    // Cursor MDC frontmatter must be at the top of the file
    const cursorContent = readFileSync(join(root, '.cursor/rules/harness.mdc'), 'utf8');
    assert.ok(cursorContent.startsWith('---\n'), 'Cursor .mdc must start with YAML frontmatter');
    assert.match(cursorContent, /^---\n[\s\S]*?alwaysApply:\s*true\n---/, 'Cursor .mdc must set alwaysApply: true');

    // Manifest and live status
    const manifest = readManifest(root);
    assert.equal(Object.keys(manifest.files).length, 3);
    assert.equal(manifest.canonicalHash, res.status.canonicalHash);

    for (const plat of res.status.platforms) {
      assert.equal(plat.status, 'synced');
      assert.match(plat.hash, /^[a-f0-9]{64}$/);
      assert.ok(plat.lastSyncedAt, `${plat.id} must have lastSyncedAt`);
      assert.equal(plat.promptAmplifierIncluded, true);
    }
  });

  it('is idempotent — a second sync writes 0 files and preserves hashes', () => {
    const root = createIsolatedRepo();
    const first = syncAdapters(root, { skipCliCheck: true });
    assert.equal(first.written.length, 3);

    const beforeHash = sha256(readFileSync(join(root, '.gemini/rules/harness.md'), 'utf8'));
    const second = syncAdapters(root, { skipCliCheck: true });

    assert.equal(second.ok, true);
    assert.deepEqual(second.written, []);
    assert.equal(second.unchanged.length, 3);
    assert.equal(second.status.inParityCount, 4);

    const afterHash = sha256(readFileSync(join(root, '.gemini/rules/harness.md'), 'utf8'));
    assert.equal(afterHash, beforeHash);
  });

  it('detects canonical drift (manuallyEdited: false) and updates safely without confirmOverwrite', () => {
    const root = createIsolatedRepo();
    syncAdapters(root, { skipCliCheck: true });

    // Simulate a canonical rule update
    const rulePath = join(root, '.claude/rules/00-core.md');
    writeFileSync(rulePath, `${readFileSync(rulePath, 'utf8')}\n\n<!-- canonical-change-test -->\n`, 'utf8');

    const driftedStatus = getAdaptersStatus(root, { skipCliCheck: true });
    assert.equal(driftedStatus.inParityCount, 1);
    for (const plat of driftedStatus.platforms.filter((p) => p.id !== 'claude')) {
      assert.equal(plat.status, 'drifted');
      assert.equal(plat.manuallyEdited, false, `${plat.id} should be canonical drift, not manual edit`);
    }

    // Safe sync without confirmOverwrite should succeed
    const res = syncAdapters(root, { skipCliCheck: true });
    assert.equal(res.ok, true);
    assert.equal(res.written.length, 3);
    assert.equal(res.status.inParityCount, 4);
  });

  it('detects manual edits on generated projections (manuallyEdited: true) and blocks overwrite until confirmed', () => {
    const root = createIsolatedRepo();
    syncAdapters(root, { skipCliCheck: true });

    const agyPath = join(root, '.gemini/rules/harness.md');
    const manualContent = `${readFileSync(agyPath, 'utf8')}\n# Manual user tweak\n`;
    writeFileSync(agyPath, manualContent, 'utf8');

    const status = getAdaptersStatus(root, { skipCliCheck: true });
    assert.equal(status.inParityCount, 3);
    const agy = status.platforms.find((p) => p.id === 'antigravity');
    assert.equal(agy.status, 'drifted');
    assert.equal(agy.manuallyEdited, true);

    // Blocked without confirmOverwrite
    const blocked = syncAdapters(root, { skipCliCheck: true });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error, 'CONFIRM_OVERWRITE');
    assert.deepEqual(blocked.overwriteManual, ['.gemini/rules/harness.md']);
    assert.equal(readFileSync(agyPath, 'utf8'), manualContent, 'manual file must not be overwritten');

    // Allowed with confirmOverwrite: true
    const forced = syncAdapters(root, { confirmOverwrite: true, skipCliCheck: true });
    assert.equal(forced.ok, true);
    assert.deepEqual(forced.written, ['.gemini/rules/harness.md']);
    assert.equal(forced.status.inParityCount, 4);
  });

  it('supports selective target syncing and rejects unknown platforms', () => {
    const root = createIsolatedRepo();
    const res = syncAdapters(root, { targets: ['cursor'], skipCliCheck: true });

    assert.equal(res.ok, true);
    assert.deepEqual(res.written, ['.cursor/rules/harness.mdc']);
    assert.equal(existsSync(join(root, '.cursor/rules/harness.mdc')), true);
    assert.equal(existsSync(join(root, '.gemini/rules/harness.md')), false);
    assert.equal(res.status.inParityCount, 2); // claude + cursor

    assert.throws(() => syncAdapters(root, { targets: ['unknown-ai'] }), /Unknown platform/);
  });

  it('CLI scripts/sync-adapters.mjs enforces --check exit codes (0 synced, 1 drifted/missing, 2 manual conflict)', () => {
    const root = createIsolatedRepo();

    // 1. --check on fresh repo -> exit 1
    assert.throws(
      () =>
        execFileSync(process.execPath, [SYNC_CLI, '--check', '--root', root], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      (err) => err.status === 1,
    );

    // 2. Sync all via CLI -> exit 0
    const syncOut = execFileSync(process.execPath, [SYNC_CLI, '--root', root, '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const syncJson = JSON.parse(syncOut);
    assert.equal(syncJson.ok, true);
    assert.equal(syncJson.written.length, 3);

    // 3. --check after sync -> exit 0
    const checkOut = execFileSync(process.execPath, [SYNC_CLI, '--check', '--root', root, '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const checkJson = JSON.parse(checkOut);
    assert.equal(checkJson.ok, true);
    assert.equal(checkJson.status.inParityCount, 4);

    // 4. Manual edit -> --check exits 1, sync without --force exits 2, sync with --force exits 0
    const codexPath = join(root, '.agents/rules/harness.md');
    writeFileSync(codexPath, `${readFileSync(codexPath, 'utf8')}\nmanual edit\n`, 'utf8');

    assert.throws(
      () =>
        execFileSync(process.execPath, [SYNC_CLI, '--check', '--root', root], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      (err) => err.status === 1,
    );

    assert.throws(
      () =>
        execFileSync(process.execPath, [SYNC_CLI, '--root', root], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      (err) => err.status === 2,
    );

    const forceOut = execFileSync(process.execPath, [SYNC_CLI, '--root', root, '--force', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const forceJson = JSON.parse(forceOut);
    assert.equal(forceJson.ok, true);
    assert.equal(forceJson.status.inParityCount, 4);
  });
});
