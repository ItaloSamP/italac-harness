#!/usr/bin/env node
// Deterministic check of a task file before /build. Exit code 1 on any error.
//   node scripts/validate-task.mjs .specs/tasks/task-<slug>.md [--profile full|short]
// Profile "short" (default for task-fix-* and task-hotfix-* files) requires only Problem, Acceptance criteria and Files.
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

const args = process.argv.slice(2);
const flag = args.indexOf('--profile');
const asked = flag > -1 ? args.splice(flag, 2)[1] : null;
const path = args[0];
if (!path || !existsSync(path) || (flag > -1 && !['full', 'short'].includes(asked))) {
  console.error('usage: validate-task.mjs <task-file> [--profile full|short] — fix: pass an existing task file; the profile is "full" or "short"');
  process.exit(1);
}
const profile = asked ?? (/^task-(fix|hotfix)-/.test(basename(path)) ? 'short' : 'full');
const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const errors = [];
const warnings = [];

const section = (title) => {
  const m = text.match(new RegExp(`^## ${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  return m ? m[1].replace(/<!--[\s\S]*?-->/g, '').trim() : null;
};
// BLOCKED(<previous>) names the status to restore on resume; CANCELLED and SUPERSEDED are terminal.
const STATUSES = /^(PLANNING|IN_PROGRESS|IN_REVIEW|READY_TO_COMMIT|COMMITTED|SHIPPED|BLOCKED: .+|BLOCKED\((PLANNING|IN_PROGRESS|IN_REVIEW|READY_TO_COMMIT)\): .+|CANCELLED|SUPERSEDED: .+)$/;

const status = (text.match(/^## Status:\s*(.+)$/m) || [])[1]?.trim();
if (!status) errors.push('missing "## Status:" line');
else if (!STATUSES.test(status)) errors.push(`status "${status}" is not in the state machine`);

const REQUIRED = profile === 'short' ? ['Problem', 'Acceptance criteria', 'Files'] : ['Problem', 'Acceptance criteria', 'Out of scope', 'Approach', 'Files', 'Test scope'];
for (const required of REQUIRED) {
  const body = section(required);
  if (body === null) errors.push(`missing section "## ${required}"`);
  else if (!body) errors.push(`section "## ${required}" is empty`);
  else if (/<[^>\n]{3,}>/.test(body)) errors.push(`section "## ${required}" still has a template placeholder`);
}

const acBody = section('Acceptance criteria') ?? '';
const acs = acBody.split('\n').filter((l) => /^- \[[ x]\]/.test(l));
if (!acs.length) errors.push('no acceptance criteria (lines starting with "- [ ]")');

// Vague adjectives make a criterion untestable unless a number sits next to them.
const VAGUE = /\b(fast|quick(ly)?|slow|scalable|secure|robust|intuitive|user-friendly|easy|simple|seamless|efficient|reliable|properly|correctly|appropriate(ly)?|good|nice|clean)\b/i;
for (const ac of acs) {
  const claim = ac.split('— evidence:')[0];
  const hit = claim.match(VAGUE);
  if (hit && !/\d/.test(claim)) warnings.push(`AC is not testable as written ("${hit[0]}" without a measure): ${claim.trim().slice(0, 90)}`);
  if (/\b(TODO|TBD|\?\?\?)\b/.test(claim)) errors.push(`AC has an unresolved marker: ${claim.trim().slice(0, 90)}`);
}

// The external oracle: "## Proof", or the "Proof:" line of the "## Amplified brief" block in task files written before it.
const proof = section('Proof') ?? ((section('Amplified brief') ?? '').match(/Proof[^:\n]*:\s*(.*)/) || [])[1]?.trim();
if (profile === 'full' && (!proof || /^</.test(proof))) errors.push('no external oracle named — fix: name what proves the result besides us under "## Proof"');

const files = (section('Files') ?? '').split('\n').filter((l) => /^- /.test(l));
if (!files.length) errors.push('"## Files" lists no files');

// Slices must not share files: two writers never touch the same file.
const slices = (section('Slices') ?? '').split('\n').filter((l) => /^\| *S\d+/.test(l));
const seen = new Map();
for (const line of slices) {
  const cells = line.split('|').map((c) => c.trim());
  for (const f of (cells[2] ?? '').split(/[,\s]+/).filter((x) => /[./]/.test(x))) {
    if (seen.has(f)) errors.push(`file ${f} is in two slices (${seen.get(f)} and ${cells[1]})`);
    else seen.set(f, cells[1]);
  }
}

if (['READY_TO_COMMIT', 'COMMITTED', 'SHIPPED'].includes(status)) {
  for (const ac of acs) {
    if (/^- \[ \]/.test(ac)) errors.push(`status is ${status} but an AC is unchecked: ${ac.slice(6, 90)}`);
    else if (!/— evidence:\s*\S/.test(ac)) errors.push(`status is ${status} but an AC has no evidence: ${ac.slice(6, 90)}`);
  }
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`Task file: ${errors.length ? 'FAIL' : 'PASS'} (${errors.length} errors, ${warnings.length} warnings) — profile ${profile}, ${acs.length} ACs, ${files.length} files, ${slices.length} slices`);
process.exit(errors.length ? 1 : 0);
