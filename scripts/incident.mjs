#!/usr/bin/env node
// Harness incident log (rule 85). Append-only JSONL at .specs/harness/incidents.jsonl.
//   node scripts/incident.mjs add  --key <pattern-key> --layer <rule|agent|skill|brief|tool> --what "<text>" [--where <file>]
//   node scripts/incident.mjs fix  --key <pattern-key> --fix "<what changed>"
//   node scripts/incident.mjs upstreamed --key <pattern-key>
//   node scripts/incident.mjs open | list | summary | pending-upstream      [--root <path>]
// Exit code 3 from `pending-upstream` means fixes exist that were not ported to the harness repository.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : undefined;
};
const root = resolve(opt('root') ?? process.cwd());
const file = join(root, '.specs', 'harness', 'incidents.jsonl');
const LAYERS = ['rule', 'agent', 'skill', 'brief', 'tool'];
// The harness repository itself has the installers; anywhere else is an installed copy.
const isHarnessRepo = existsSync(join(root, 'install.ps1')) && existsSync(join(root, 'optional'));

function events() {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
}
function state() {
  const byKey = new Map();
  for (const e of events()) {
    const s = byKey.get(e.key) ?? { key: e.key, count: 0, status: 'open', upstream: 'n/a' };
    if (e.type === 'occurrence') {
      s.count += 1;
      s.status = 'open';
      Object.assign(s, { layer: e.layer, what: e.what, where: e.where, last: e.date });
      s.first ??= e.date;
    } else if (e.type === 'fix') {
      Object.assign(s, { status: 'fixed', fix: e.fix, upstream: e.upstream, fixed: e.date });
    } else if (e.type === 'upstreamed') {
      s.upstream = 'done';
    }
    byKey.set(e.key, s);
  }
  return [...byKey.values()];
}
function write(event) {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), ...event })}\n`);
}
function fail(msg) {
  console.error(msg);
  process.exit(1);
}
const row = (s) =>
  `${s.status === 'open' ? 'OPEN ' : 'fixed'} ×${s.count} ${s.key} [${s.layer ?? '?'}] ${s.what ?? ''}${s.where ? ` (${s.where})` : ''}${s.fix ? ` → ${s.fix}` : ''}${s.upstream === 'pending' ? ' [upstream: pending]' : ''}`;

if (cmd === 'add') {
  const key = opt('key');
  const layer = opt('layer');
  const what = opt('what');
  if (!key || !/^[a-z0-9][a-z0-9-]+$/.test(key)) fail('--key must be a kebab-case pattern key');
  if (!LAYERS.includes(layer)) fail(`--layer must be one of ${LAYERS.join(', ')}`);
  if (!what) fail('--what is required');
  write({ type: 'occurrence', key, layer, what, where: opt('where') });
  const s = state().find((x) => x.key === key);
  console.log(`logged ${key} — occurrence ${s.count}${s.count >= 2 ? ' — RECURRING: find the cause in the harness and fix it (rule 85)' : ''}`);
} else if (cmd === 'fix') {
  const key = opt('key');
  const fix = opt('fix');
  if (!state().some((s) => s.key === key)) fail(`no incident with key "${key}" — log it with add first`);
  if (!fix) fail('--fix is required');
  write({ type: 'fix', key, fix, upstream: isHarnessRepo ? 'n/a' : 'pending' });
  console.log(`closed ${key}${isHarnessRepo ? '' : ' — upstream: pending (port this fix to the harness repository)'}`);
} else if (cmd === 'upstreamed') {
  const key = opt('key');
  if (!state().some((s) => s.key === key)) fail(`no incident with key "${key}"`);
  write({ type: 'upstreamed', key });
  console.log(`marked ${key} as ported upstream`);
} else if (cmd === 'open' || cmd === 'list') {
  const rows = state().filter((s) => cmd === 'list' || s.status === 'open');
  console.log(rows.length ? rows.map(row).join('\n') : cmd === 'open' ? 'no open incidents' : 'no incidents');
} else if (cmd === 'summary') {
  const all = state();
  const open = all.filter((s) => s.status === 'open');
  const recurring = open.filter((s) => s.count >= 2).map((s) => s.key);
  const pending = all.filter((s) => s.upstream === 'pending').length;
  if (open.length || pending) {
    console.log(`${open.length} open incident(s)${recurring.length ? ` — recurring: ${recurring.join(', ')}` : ''}${pending ? ` · ${pending} fix(es) not ported upstream` : ''}`);
  }
} else if (cmd === 'pending-upstream') {
  const pending = state().filter((s) => s.upstream === 'pending');
  if (pending.length) {
    console.log(pending.map(row).join('\n'));
    process.exit(3);
  }
} else {
  fail('usage: incident.mjs add|fix|upstreamed|open|list|summary|pending-upstream  (see file header)');
}
