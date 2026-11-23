#!/usr/bin/env node
// The change of one task, as a patch file a reviewer can read. Works before anything is committed.
//   node scripts/task-diff.mjs <task-file> --init    write "Base: <sha> (<branch>)" into the task file, once
//   node scripts/task-diff.mjs <task-file>           patch of the files listed in "## Files", against Base
//   node scripts/task-diff.mjs --base <ref>          no task file: whole working tree against <ref> (default HEAD)
// Exit: 0 patch written (or Base printed) · 2 in-scope diff is empty · 1 usage, missing Base, not a repository.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const fail = (msg) => {
  console.error(`task-diff: ${msg}`);
  process.exit(1);
};
const USAGE = 'usage: task-diff.mjs <task-file> [--init] | task-diff.mjs --base <ref> — fix: pass an existing task file, or --base <ref> for an ad-hoc diff';

let taskFile = null;
let init = false;
let baseRef = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--init') init = true;
  else if (a === '--base') baseRef = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : 'HEAD';
  else if (a.startsWith('-') || taskFile) fail(USAGE);
  else taskFile = a;
}
if (taskFile && (baseRef || !existsSync(taskFile))) fail(USAGE);
if (init && !taskFile) fail(USAGE);

let root = process.cwd();
// Git output is read as text; paths are asked for NUL-separated and unquoted.
const git = (args, opts = {}) => spawnSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
const top = git(['rev-parse', '--show-toplevel']);
if (top.status !== 0) fail('not a git repository — fix: run it inside the project repository');
root = resolve(top.stdout.trim());

const names = (args) => git(args).stdout.split('\0').filter(Boolean);
const slash = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '');

// ---- --init ---------------------------------------------------------------------
if (init) {
  const text = readFileSync(taskFile, 'utf8');
  const existing = text.match(/^Base: .*$/m);
  if (existing) {
    console.log(existing[0].trim());
    process.exit(0);
  }
  const status = text.match(/^## Status:.*$/m);
  if (!status) fail(`${taskFile} has no "## Status:" line — fix: start the task file from .claude/templates/task.md`);
  const head = git(['rev-parse', '--verify', '-q', 'HEAD']);
  const branch = git(['symbolic-ref', '--short', '-q', 'HEAD']).stdout.trim() || 'detached';
  const line = `Base: ${head.status === 0 ? head.stdout.trim() : 'EMPTY'} (${branch})`;
  const at = status.index + status[0].length; // end of the status line, before its line break
  writeFileSync(taskFile, `${text.slice(0, at)}${text.includes('\r\n') ? '\r\n' : '\n'}${line}${text.slice(at)}`);
  console.log(line);
  process.exit(0);
}

// ---- base and scope ---------------------------------------------------------------
const emptyTree = () => git(['hash-object', '-t', 'tree', '--stdin'], { input: '' }).stdout.trim();
const commit = (ref) => git(['rev-parse', '--verify', '-q', `${ref}^{commit}`]);

let base; // a commit or the empty tree
let scope = null; // null = whole working tree
let label = 'adhoc';
let taskRel = null;
if (taskFile) {
  const text = readFileSync(taskFile, 'utf8').replace(/\r\n/g, '\n');
  const sha = (text.match(/^Base:\s*(\S+)/m) || [])[1];
  if (!sha) fail(`${taskFile} has no "Base:" line — fix: run node scripts/task-diff.mjs ${taskFile} --init`);
  if (sha === 'EMPTY') base = emptyTree();
  else if (/^[0-9a-f]{7,64}$/.test(sha) && commit(sha).status === 0) base = sha;
  else fail(`Base "${sha}" is not a commit of this repository — fix: correct the Base line in ${taskFile}`);
  const files = (text.match(/^## Files[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m) || [])[1] ?? '';
  scope = files.split('\n').filter((l) => /^- /.test(l)).map((l) => (l.match(/`([^`]+)`/) || [])[1]).filter(Boolean).map(slash);
  label = basename(taskFile).replace(/\.md$/, '');
  taskRel = slash(relative(root, resolve(taskFile)));
} else {
  const ref = baseRef ?? 'HEAD';
  const found = commit(ref);
  if (found.status === 0) base = found.stdout.trim();
  else if (ref === 'HEAD') base = emptyTree(); // no commit yet: everything is new
  else fail(`"${ref}" is not a commit of this repository — fix: pass an existing branch, tag or sha to --base`);
}

// ---- changed set ------------------------------------------------------------------
const LOGS = '.specs/logs/'; // our own output is never part of the change
const untracked = new Set(names(['ls-files', '--others', '--exclude-standard', '-z']));
const changed = [...new Set([...names(['diff', '--name-only', '-z', base]), ...untracked])].filter((p) => !p.startsWith(LOGS)).sort();
const inScope = (p) => !scope || scope.some((s) => p === s || (s.endsWith('/') && p.startsWith(s)));
const outside = changed.filter((p) => !inScope(p) && p !== taskRel);

// One patch section per in-scope file; an untracked file becomes a new-file patch.
const sections = new Map();
for (const p of changed.filter(inScope)) {
  const out = untracked.has(p) ? git(['diff', '--no-index', '--', '/dev/null', p]).stdout : git(['diff', base, '--', p]).stdout;
  if (out) sections.set(p, out);
}

const outsideLine = () => { if (scope) console.log(`outside ## Files: ${outside.join(', ') || 'none'}`); };
if (!sections.size) {
  console.log(`task-diff: in-scope diff is empty — fix: nothing to review; check Base and ## Files`);
  outsideLine();
  process.exit(2);
}

// ---- write round n ------------------------------------------------------------------
const logsDir = join(root, '.specs', 'logs');
mkdirSync(logsDir, { recursive: true });
const round = new RegExp(`^diff-${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-r(\\d+)\\.patch$`);
const n = 1 + Math.max(0, ...readdirSync(logsDir).map((f) => Number((f.match(round) || [])[1] ?? 0)));
const patch = [...sections.values()].join('');
writeFileSync(join(logsDir, `diff-${label}-r${n}.patch`), patch);

let added = 0;
let removed = 0;
let inHunk = false;
for (const line of patch.split('\n')) {
  if (line.startsWith('diff --git ')) inHunk = false;
  else if (line.startsWith('@@')) inHunk = true;
  else if (inHunk && line.startsWith('+')) added += 1;
  else if (inHunk && line.startsWith('-')) removed += 1;
}
console.log(`diff: ${LOGS}diff-${label}-r${n}.patch · ${sections.size} files · +${added}/−${removed}`);
outsideLine();

if (n > 1) {
  // Sections of the previous round, keyed by the path in their "diff --git a/<path> b/<path>" header.
  const previous = new Map();
  for (const part of readFileSync(join(logsDir, `diff-${label}-r${n - 1}.patch`), 'utf8').split(/^(?=diff --git )/m)) {
    const header = part.slice(0, part.indexOf('\n'));
    const half = (header.length - 'diff --git a/'.length - ' b/'.length) / 2;
    previous.set(header.slice('diff --git a/'.length, 'diff --git a/'.length + half), part);
  }
  const since = [...new Set([...sections.keys(), ...previous.keys()])].filter((p) => sections.get(p) !== previous.get(p)).sort();
  console.log(`changed since r${n - 1}: ${since.join(', ') || 'none'}`);
}
