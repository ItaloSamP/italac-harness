#!/usr/bin/env node
// Self-test of the harness scripts (harness repository only — not installed into projects).
// Builds throwaway git repositories under os.tmpdir(), runs the scripts against them and asserts
// the exit code and one stdout substring per case. Exit code 0 only if every case passes.
//   node evals/scripts/selftest.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts');
const made = [];
let failed = 0;

// A fresh git repository holding the given files ({ 'relative/path': 'content' }).
function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'harness-selftest-'));
  made.push(dir);
  const git = spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8' });
  if (git.status !== 0) throw new Error(`git init failed in ${dir}: ${git.error?.message ?? git.stderr} — fix: install git and put it on PATH`);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

function check(name, script, args, cwd, exit, substring) {
  const run = spawnSync(process.execPath, [join(scripts, script), ...args], { cwd, encoding: 'utf8' });
  const pass = run.status === exit && run.stdout.includes(substring);
  if (!pass) failed += 1;
  console.log(`${pass ? 'ok' : 'FAIL'} ${name}`);
  if (!pass) console.log(`     expected exit ${exit} and stdout containing "${substring}"; got exit ${run.status}\n${(run.stdout + run.stderr).trim().replace(/^/gm, '     ')}`);
}

const TASK = `# Task: export orders as CSV

## Status: PLANNING

## Proof
The export test suite

## Problem
Operators cannot get orders out of the system.

## Acceptance criteria
- [ ] GET /orders.csv returns one row per order — evidence:

## Out of scope
- Excel output

## Approach
Add a CSV serializer in src/orders/export.ts and a route that calls it.

## Files
- \`src/orders/export.ts\` — new serializer

## Test scope
Run: src/orders/export.test.ts
`;
const TASK_FILE = '.specs/tasks/task-export.md';

// Git in a throwaway repository, with an identity so commits work on any machine.
function git(cwd, ...args) {
  const run = spawnSync('git', ['-c', 'user.name=selftest', '-c', 'user.email=selftest@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${run.stderr} — fix: check the git installation`);
  return run.stdout;
}

function expect(name, pass, detail = '') {
  if (!pass) failed += 1;
  console.log(`${pass ? 'ok' : 'FAIL'} ${name}`);
  if (!pass && detail) console.log(String(detail).trim().replace(/^/gm, '     '));
}

const withFiles = (list) => TASK.replace(/## Files\n[^\n]*\n/, `## Files\n${list.map((f) => `- \`${f}\` — change`).join('\n')}\n`);

try {
  // ---- task-diff.mjs --------------------------------------------------------------
  {
    const dir = repo({ [TASK_FILE]: withFiles(['src/a.js', 'src/b.js']), 'src/a.js': 'alpha\n', 'src/b.js': 'beta\n' });
    git(dir, 'symbolic-ref', 'HEAD', 'refs/heads/master');
    check('task-diff: --init on a zero-commit repository writes Base: EMPTY', 'task-diff.mjs', [TASK_FILE, '--init'], dir, 0, 'Base: EMPTY (master)');
    check('task-diff: zero-commit repository with two new files writes a patch', 'task-diff.mjs', [TASK_FILE], dir, 0, 'diff-task-export-r1.patch · 2 files · +2/−0');
    const patch = readFileSync(join(dir, '.specs/logs/diff-task-export-r1.patch'), 'utf8');
    expect('task-diff: that patch has the added lines of both files', patch.includes('+alpha') && patch.includes('+beta'), patch);
    check('task-diff: --init a second time prints the existing line', 'task-diff.mjs', [TASK_FILE, '--init'], dir, 0, 'Base: EMPTY (master)');
    const baseLines = readFileSync(join(dir, TASK_FILE), 'utf8').match(/^Base: /gm) ?? [];
    expect('task-diff: --init twice leaves one Base line', baseLines.length === 1, `${baseLines.length} Base lines`);
    check('task-diff: --base on a zero-commit repository diffs the whole tree', 'task-diff.mjs', ['--base', 'HEAD'], dir, 0, 'diff-adhoc-r1.patch · 3 files');
  }
  {
    const dir = repo({ [TASK_FILE]: withFiles(['src/a.js', 'src/new.js']), 'src/a.js': 'alpha\n', 'other.txt': 'one\n' });
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'base');
    check('task-diff: no Base line is a usage error', 'task-diff.mjs', [TASK_FILE], dir, 1, '');
    check('task-diff: --init on a committed repository writes the sha', 'task-diff.mjs', [TASK_FILE, '--init'], dir, 0, `Base: ${git(dir, 'rev-parse', 'HEAD').trim()} (`);
    check('task-diff: nothing changed in scope exits 2', 'task-diff.mjs', [TASK_FILE], dir, 2, 'fix: nothing to review; check Base and ## Files');
    writeFileSync(join(dir, 'src/a.js'), 'alpha\nalpha2\n');
    writeFileSync(join(dir, 'src/new.js'), 'fresh\n');
    writeFileSync(join(dir, 'other.txt'), 'one\ntwo\n');
    check('task-diff: tracked edit + untracked file in scope, unrelated dirty file named as outside', 'task-diff.mjs', [TASK_FILE], dir, 0, 'outside ## Files: other.txt\n');
    const patch = readFileSync(join(dir, '.specs/logs/diff-task-export-r1.patch'), 'utf8');
    expect('task-diff: that patch has the two in-scope files and not the unrelated one',
      patch.includes('+alpha2') && patch.includes('+fresh') && !patch.includes('two'), patch);
    writeFileSync(join(dir, 'src/new.js'), 'fresh\nfixed\n');
    check('task-diff: second round names only the file edited since r1', 'task-diff.mjs', [TASK_FILE], dir, 0, 'changed since r1: src/new.js\n');
    check('task-diff: outside a git repository exits 1', 'task-diff.mjs', ['--base', 'HEAD'], tmpdir(), 1, '');
  }

  // ---- validate-task.mjs ----------------------------------------------------------
  check('validate-task: a full valid file passes', 'validate-task.mjs', [TASK_FILE],
    repo({ [TASK_FILE]: TASK }), 0, 'Task file: PASS');
  check('validate-task: a file without "## Approach" fails', 'validate-task.mjs', [TASK_FILE],
    repo({ [TASK_FILE]: TASK.replace(/## Approach\n[^\n]*\n\n/, '') }), 1, 'missing section "## Approach"');

  check('validate-task: a "## Proof" section that is still the template placeholder fails', 'validate-task.mjs', [TASK_FILE],
    repo({ [TASK_FILE]: TASK.replace('The export test suite', '<external oracle: what proves the result besides us>') }), 1, 'no external oracle named — fix: ');
  check('validate-task: a task file written with the old "## Amplified brief" block still passes', 'validate-task.mjs', [TASK_FILE],
    repo({ [TASK_FILE]: TASK.replace('## Proof\nThe export test suite', '## Amplified brief\n1. Pro move: stream the rows\n4. Proof (external oracle): the export test suite') }), 0, 'Task file: PASS');

  const SHORT = `# Task: fix the profile save

## Status: IN_REVIEW

## Problem
Saving the profile fails because the form sends an empty id (src/profile/save.ts:12).

## Acceptance criteria
- [ ] The regression test passes — evidence:
- [ ] The original repro saves the profile — evidence:

## Files
- \`src/profile/save.ts\` — send the id
`;
  check('validate-task: a short bugfix file named task-fix-* passes', 'validate-task.mjs', ['.specs/tasks/task-fix-x.md'],
    repo({ '.specs/tasks/task-fix-x.md': SHORT }), 0, 'Task file: PASS (0 errors, 0 warnings) — profile short, 2 ACs');
  check('validate-task: a short hotfix file named task-hotfix-* passes', 'validate-task.mjs', ['.specs/tasks/task-hotfix-x.md'],
    repo({ '.specs/tasks/task-hotfix-x.md': SHORT }), 0, 'profile short');
  check('validate-task: the same content named task-x.md fails', 'validate-task.mjs', ['.specs/tasks/task-x.md'],
    repo({ '.specs/tasks/task-x.md': SHORT }), 1, 'missing section "## Approach"');
  check('validate-task: --profile short overrides the name', 'validate-task.mjs', ['.specs/tasks/task-x.md', '--profile', 'short'],
    repo({ '.specs/tasks/task-x.md': SHORT }), 0, 'profile short');
  check('validate-task: --profile full overrides the name', 'validate-task.mjs', ['.specs/tasks/task-fix-x.md', '--profile', 'full'],
    repo({ '.specs/tasks/task-fix-x.md': SHORT }), 1, 'no external oracle named');
  const withStatus = (status) => repo({ [TASK_FILE]: TASK.replace('## Status: PLANNING', `## Status: ${status}`) });
  for (const status of ['BLOCKED(IN_PROGRESS): waiting key', 'CANCELLED', 'SUPERSEDED: task-y', 'BLOCKED: waiting key']) {
    check(`validate-task: status "${status}" is valid`, 'validate-task.mjs', [TASK_FILE], withStatus(status), 0, 'Task file: PASS');
  }
  check('validate-task: status "BLOCKED(DONE): x" is invalid', 'validate-task.mjs', [TASK_FILE],
    withStatus('BLOCKED(DONE): x'), 1, 'status "BLOCKED(DONE): x" is not in the state machine');

  // ---- .claude/hooks/session-start.mjs ---------------------------------------------
  const hook = (status) => {
    const dir = withStatus(status);
    return spawnSync(process.execPath, [join(scripts, '..', '.claude', 'hooks', 'session-start.mjs')], { cwd: dir, encoding: 'utf8' }).stdout;
  };
  const openTask = hook('IN_PROGRESS');
  expect('session-start: an IN_PROGRESS task is listed as open', openTask.includes('open tasks: task-export.md (IN_PROGRESS)'), openTask);
  for (const status of ['CANCELLED', 'SUPERSEDED: task-y']) {
    const out = hook(status);
    expect(`session-start: one ${status.split(':')[0]} task prints no open tasks line`, out.includes('[harness]') && !out.includes('open tasks'), out);
  }

  {
    const empty = mkdtempSync(join(tmpdir(), 'harness-selftest-'));
    made.push(empty);
    const out = spawnSync(process.execPath, [join(scripts, '..', '.claude', 'hooks', 'session-start.mjs')], { cwd: empty, encoding: 'utf8' }).stdout;
    expect('session-start: an empty folder is told its code is mapped on the first task, not to run a skill',
      out.includes('[harness] no context/ docs yet — mapped silently on the first T2+ task (rule 75)') && !out.includes('context-generator'), out);
    for (const installer of ['install.ps1', 'install.sh']) {
      const text = readFileSync(join(scripts, '..', installer), 'utf8');
      expect(`${installer}: copies gate.mjs, ships the Verification block and never names context-generator`,
        text.includes('gate.mjs') && text.includes('## Verification\nKind: <web |'.replace('\n', text.includes('\r\n') ? '\r\n' : '\n')) && !text.includes('context-generator'));
    }
  }

  // ---- gate.mjs -------------------------------------------------------------------
  {
    // A stand-in test runner (Node only): one "not ok" line per failing test, exit 1 when any fails.
    const runner = "const n = Number(process.argv[2]);\nconsole.log('ok 1 adds');\nfor (let i = 0; i < n; i += 1) console.log(`not ok ${i + 2} legacy`);\nprocess.exit(n ? 1 : 0);\n";
    const project = (rows, standing = '') => repo({
      'CLAUDE.md': `# Project\n\n## Verification\nKind: cli-lib\n\n| Gate | Command | Baseline |\n|------|---------|----------|\n${rows}\n| Surface | Proves it | Command or step |\n|---------|-----------|-----------------|\n\n## Standing instructions\n${standing}`,
      'run.mjs': runner,
    });
    const ACCEPTED = 'Baseline accepted: 2026-11-11 — 1 failing test\n';
    const row = (failing, baseline) => `| tests | \`node run.mjs ${failing}\` | ${baseline} |\n`;

    const green = project(row(0, 'exit0'));
    check('gate: a green command passes', 'gate.mjs', [], green, 0, 'PASS tests (exit 0)');
    expect('gate: the full output goes to .specs/logs/gate-<name>.log', readFileSync(join(green, '.specs/logs/gate-tests.log'), 'utf8').includes('ok 1 adds'));
    check('gate: an empty baseline means exit0, and a red command fails with its output', 'gate.mjs', [], project(row(1, '')), 1, 'FAIL tests (exit 1)\nok 1 adds\nnot ok 2 legacy\n');
    check('gate: max:1 with one failing test and an accepted baseline passes', 'gate.mjs', [], project(row(1, 'max:1:^not ok'), ACCEPTED), 0, 'PASS tests (1 ≤ 1)');
    check('gate: a second failing test fails the same baseline', 'gate.mjs', [], project(row(2, 'max:1:^not ok'), ACCEPTED), 1, 'FAIL tests (2 > 1)');
    check('gate: fewer failures than the baseline pass with a ratchet hint', 'gate.mjs', [], project(row(0, 'max:1:^not ok'), ACCEPTED), 0, 'ratchet: tests 0 < 1 — lower the baseline');
    check('gate: a max: baseline without the accepted line exits 3', 'gate.mjs', [], project(row(1, 'max:1:^not ok')), 3, 'fix: ask the user once to accept the baseline and record it under Standing instructions');
    check('gate: no ## Verification section exits 2', 'gate.mjs', [], repo({ 'CLAUDE.md': '# Project\n\n## Commands\n' }), 2, 'NO GATE DEFINED');
    check('gate: a table without rows exits 2', 'gate.mjs', [], project(''), 2, 'NO GATE DEFINED');
    check('gate: a row without a back-ticked command exits 3', 'gate.mjs', [], project('| tests | node run.mjs 0 | exit0 |\n'), 3, 'unreadable row');
    const two = project(`${row(1, 'exit0')}| build | \`node run.mjs 0\` | exit0 |\n`);
    check('gate: --only runs the named gate alone', 'gate.mjs', ['--only', 'build'], two, 0, 'PASS build (exit 0)');
    check('gate: --root reads another project; one red gate among two exits 1', 'gate.mjs', ['--root', two], tmpdir(), 1, 'PASS build (exit 0)');
    check('gate: a command that outlives --timeout fails', 'gate.mjs', ['--timeout', '1'],
      project('| slow | `node -e "setTimeout(()=>{},30000)"` | exit0 |\n'), 1, 'FAIL slow (timed out after 1s)');
  }

  // ---- validate-harness.mjs -------------------------------------------------------
  const overCeiling = repo({ 'CLAUDE.md': '# Constitution\n', '.claude/rules/00-big.md': 'x'.repeat(40000) });
  check('validate-harness: a rule file that pushes the always-loaded total over the ceiling fails',
    'validate-harness.mjs', ['--root', overCeiling], overCeiling, 1, 'always-loaded constitution+rules is 40015 B (max ');
  const sections = repo({
    'CLAUDE.md': '# Constitution\nRead `## Escopo de teste`, `## files` and `## Handoff`.\n',
    '.claude/templates/task.md': '# Task\n\n## Files\n',
  });
  const run = spawnSync(process.execPath, [join(scripts, 'validate-harness.mjs'), '--root', sections], { cwd: sections, encoding: 'utf8' });
  expect('validate-harness: a back-ticked section that no template has is an error; template and known headings are not',
    run.status === 1 && run.stdout.includes('CLAUDE.md — references unknown section "## Escopo de teste" — fix: ') && !run.stdout.includes('"## files"') && !run.stdout.includes('"## Handoff"'), run.stdout);
} finally {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
}

console.log(`Selftest: ${failed ? 'FAIL' : 'PASS'} (${failed} failed)`);
process.exit(failed ? 1 : 0);
