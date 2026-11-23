#!/usr/bin/env node
// The project's declared gate: runs every row of the Gate table under "## Verification" in CLAUDE.md.
//   node scripts/gate.mjs [--root <path>] [--only <gate name>] [--timeout <seconds>]
// Row: | <name> | `<command>` | <baseline> |      (the command is taken literally, pipes included)
// Baseline: exit0 (default when empty) — the command must exit 0.
//           max:<N>:<regex> — at most N output lines match <regex>, whatever the exit code (no "|" in the regex).
// Exit: 0 all pass · 1 at least one FAIL · 2 NO GATE DEFINED · 3 unreadable table, usage, or a max: row the user never accepted.
// The commands are the project's own trusted configuration: they are run through the shell as written.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const stop = (code, msg) => {
  console.log(msg);
  process.exit(code);
};
const USAGE = 'usage: gate.mjs [--root <path>] [--only <gate name>] [--timeout <seconds>] — fix: pass each option with its value';

let root = process.cwd();
let only = null;
let timeout = 0; // seconds per command; 0 = no limit
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  const value = argv[i + 1];
  if (value === undefined) stop(3, USAGE);
  if (argv[i] === '--root') root = resolve(value);
  else if (argv[i] === '--only') only = value;
  else if (argv[i] === '--timeout' && Number(value) > 0) timeout = Number(value);
  else stop(3, USAGE);
}

// ---- read the table ---------------------------------------------------------------
const NONE = 'NO GATE DEFINED — fix: add at least one row to the "| Gate | Command | Baseline |" table under "## Verification" in CLAUDE.md (adoption steps: .claude/skills/build/references/verification.md)';
const file = join(root, 'CLAUDE.md');
if (!existsSync(file)) stop(2, NONE);
const lines = readFileSync(file, 'utf8').split(/\r?\n/);
const start = lines.findIndex((l) => /^## Verification\s*$/.test(l));
if (start < 0) stop(2, NONE);
const next = lines.findIndex((l, i) => i > start && /^#{1,2} /.test(l));
const section = lines.slice(start + 1, next < 0 ? lines.length : next);
const header = section.findIndex((l) => /^\|\s*Gate\b/.test(l));
if (header < 0) stop(2, NONE);

let gates = [];
for (const raw of section.slice(header + 1)) {
  const line = raw.trim();
  if (!line.startsWith('|')) break; // the table ends at the first line that is not a row
  if (/^\|[\s:|-]+\|$/.test(line)) continue; // separator row
  const row = line.match(/^\|\s*([^|`]+?)\s*\|\s*`(.+)`\s*\|\s*([^|]*?)\s*\|$/);
  if (!row) stop(3, `gate: unreadable row "${line}" — fix: write it as | <name> | \`<command>\` | <baseline> |`);
  const [, name, command, baseline] = row;
  const max = baseline.match(/^max:(\d+):(.+)$/);
  if (!max && baseline !== '' && baseline !== 'exit0') stop(3, `gate: unreadable baseline "${baseline}" in row "${name}" — fix: use exit0 or max:<N>:<regex>`);
  let regex = null;
  if (max) {
    try { regex = new RegExp(max[2]); } catch (e) { stop(3, `gate: invalid regex in row "${name}": ${e.message} — fix: correct the regex after max:<N>:`); }
  }
  gates.push({ name, command, limit: max ? Number(max[1]) : null, regex });
}
if (!gates.length) stop(2, NONE);
if (gates.some((g) => g.regex) && !lines.some((l) => /^(?:[-*] )?Baseline accepted:\s*\S/.test(l))) {
  stop(3, 'gate: a max: baseline has no "Baseline accepted:" line in CLAUDE.md — fix: ask the user once to accept the baseline and record it under Standing instructions');
}
if (only !== null) {
  gates = gates.filter((g) => g.name === only);
  if (!gates.length) stop(3, `gate: no gate named "${only}" — fix: pass a name from the Gate column of the table under "## Verification"`);
}

// ---- run ----------------------------------------------------------------------------
// One command through the shell, output to the open log file. A timeout kills the whole process tree, not only the shell.
function execute(command, fd) {
  return new Promise((done) => {
    const posixGroup = timeout > 0 && process.platform !== 'win32';
    const child = spawn(command, { cwd: root, shell: true, stdio: ['ignore', fd, fd], detached: posixGroup });
    let timedOut = false;
    const timer = timeout > 0 && setTimeout(() => {
      timedOut = true;
      if (posixGroup) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
      } else spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    }, timeout * 1000);
    child.on('error', (error) => { clearTimeout(timer); done({ error }); });
    child.on('exit', (status, signal) => { clearTimeout(timer); done({ status, signal, timedOut }); });
  });
}

mkdirSync(join(root, '.specs', 'logs'), { recursive: true });
let failed = false;
for (const g of gates) {
  const log = `.specs/logs/gate-${g.name.replace(/[^\w.-]+/g, '-')}.log`;
  const fd = openSync(join(root, log), 'w');
  const run = await execute(g.command, fd);
  closeSync(fd);
  const output = readFileSync(join(root, log), 'utf8').trimEnd().split(/\r?\n/);

  let pass;
  let detail;
  let hint = null;
  if (run.error || run.timedOut) {
    pass = false;
    detail = run.timedOut ? `timed out after ${timeout}s` : run.error.message;
  } else if (g.regex) {
    const count = output.filter((l) => g.regex.test(l)).length;
    pass = count <= g.limit;
    detail = `${count} ${pass ? '≤' : '>'} ${g.limit}`;
    if (count < g.limit) hint = `ratchet: ${g.name} ${count} < ${g.limit} — lower the baseline`;
  } else {
    pass = run.status === 0;
    detail = `exit ${run.status ?? run.signal}`;
  }
  console.log(`${pass ? 'PASS' : 'FAIL'} ${g.name} (${detail})`);
  if (hint) console.log(hint);
  if (!pass) {
    failed = true;
    console.log(output.slice(-40).join('\n'));
    console.log(`full output: ${log}`);
  }
}
process.exit(failed ? 1 : 0);
