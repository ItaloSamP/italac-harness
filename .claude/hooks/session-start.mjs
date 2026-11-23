#!/usr/bin/env node
// SessionStart hook: prints a short status so a fresh session can resume work.
// Must never fail the session: every error is swallowed.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const lines = [];

try {
  const ctxDir = join(root, 'context');
  const ctx = existsSync(ctxDir) ? readdirSync(ctxDir).filter((f) => f.endsWith('.md')) : [];
  lines.push(
    ctx.length
      ? `[harness] context: ${ctx.join(', ')}`
      : '[harness] no context/ docs yet — mapped silently on the first T2+ task (rule 75)',
  );

  const tasksDir = join(root, '.specs', 'tasks');
  if (existsSync(tasksDir)) {
    const open = [];
    for (const file of readdirSync(tasksDir).filter((f) => f.endsWith('.md'))) {
      const text = readFileSync(join(tasksDir, file), 'utf8');
      const status = (text.match(/^## Status:\s*(.+)$/m) || [])[1]?.trim() ?? 'UNKNOWN';
      if (!/^(SHIPPED|COMMITTED|CANCELLED|SUPERSEDED)/.test(status)) open.push(`${file} (${status})`);
    }
    if (open.length) lines.push(`[harness] open tasks: ${open.slice(0, 8).join(' · ')}`);
  }

  const incidentsPath = join(root, '.specs', 'harness', 'incidents.jsonl');
  if (existsSync(incidentsPath)) {
    const byKey = new Map();
    for (const line of readFileSync(incidentsPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
      const e = JSON.parse(line);
      const s = byKey.get(e.key) ?? { count: 0, open: true };
      if (e.type === 'occurrence') { s.count += 1; s.open = true; }
      if (e.type === 'fix') s.open = false;
      byKey.set(e.key, s);
    }
    const open = [...byKey].filter(([, s]) => s.open);
    const recurring = open.filter(([, s]) => s.count >= 2).map(([k]) => k);
    if (open.length) lines.push(`[harness] ${open.length} open harness incident(s)${recurring.length ? ` — recurring: ${recurring.join(', ')}` : ''} → /retro`);
  }

  const statePath = join(root, '.specs', 'STATE.md');
  if (existsSync(statePath)) {
    const state = readFileSync(statePath, 'utf8');
    const pick = (label) => (state.match(new RegExp('\\*\\*' + label + ':\\*\\*\\s*(.+)')) || [])[1]?.trim();
    lines.push(`[harness] project state — phase: ${pick('Phase') ?? '?'} · next: ${pick('Next') ?? '?'} (.specs/STATE.md)`);
  }

  lines.push('[harness] loop: amplify → triage → route → prove. Rules in .claude/rules/.');
} catch {
  // ignore
}

if (lines.length) console.log(lines.join('\n'));
