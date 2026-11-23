#!/usr/bin/env node
// Structural validator for the agent harness. Exit code 1 on any error.
// Usage: node scripts/validate-harness.mjs [--root <path>]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Ceilings for what every session pays before any work starts. Raising one is a deliberate edit here.
const MAX_ALWAYS_BYTES = 33000; // CLAUDE.md constitution (up to "# Project") + every .claude/rules/*.md
const MAX_DESC_CHARS = 19300; // agent + skill descriptions

const argRoot = process.argv.indexOf('--root');
const root = resolve(
  argRoot > -1 ? process.argv[argRoot + 1] : join(dirname(fileURLToPath(import.meta.url)), '..'),
);
const claude = join(root, '.claude');
const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file} — ${msg}`);
const warn = (file, msg) => warnings.push(`${file} — ${msg}`);
const rel = (p) => p.slice(root.length + 1).replace(/\\/g, '/');
const read = (p) => readFileSync(p, 'utf8');

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

// ---- agents -----------------------------------------------------------------
const agentsDir = join(claude, 'agents');
const agents = new Set();
let budget = 0;
for (const file of existsSync(agentsDir) ? readdirSync(agentsDir) : []) {
  if (!file.endsWith('.md')) continue;
  const path = join(agentsDir, file);
  const text = read(path);
  const fm = frontmatter(text);
  const expected = file.replace(/\.md$/, '');
  agents.add(expected);
  if (!fm) { err(rel(path), 'missing frontmatter'); continue; }
  if (fm.name !== expected) err(rel(path), `name "${fm.name}" must match filename "${expected}"`);
  if (!fm.description || fm.description.length < 40) err(rel(path), 'description missing or too short to route on');
  if (!/Use (when|for|to|after|at)/i.test(fm.description || '')) warn(rel(path), 'description should say when to use the agent');
  if (!text.includes('## Handoff')) err(rel(path), 'missing "## Handoff" block');
  if (!text.includes('STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_HELP | BLOCKED')) err(rel(path), 'handoff STATUS line is not the canonical vocabulary');
  if (!fm.tools) warn(rel(path), 'no tools field — agent inherits every tool');
  budget += (fm.description || '').length;
  if (!/^#+ .*Hard rules/im.test(text)) warn(rel(path), 'no "Hard rules" section');
}

// ---- skills -----------------------------------------------------------------
const skillsDir = join(claude, 'skills');
const skills = new Set();
for (const dir of existsSync(skillsDir) ? readdirSync(skillsDir) : []) {
  const path = join(skillsDir, dir, 'SKILL.md');
  if (!statSync(join(skillsDir, dir)).isDirectory()) continue;
  if (!existsSync(path)) { err(rel(join(skillsDir, dir)), 'missing SKILL.md'); continue; }
  skills.add(dir);
  const fm = frontmatter(read(path));
  if (!fm) { err(rel(path), 'missing frontmatter'); continue; }
  if (fm.name !== dir) err(rel(path), `name "${fm.name}" must match directory "${dir}"`);
  if (!('description' in fm)) err(rel(path), 'missing description');
  if (/(license|metadata|version|name):s/.test(fm.description || '')) err(rel(path), 'description swallowed another frontmatter key (a newline was lost) — fix: put each frontmatter key on its own line');
  const d = fm.description || '';
  budget += d.length;
  if (d.length > 1024) err(rel(path), `description is ${d.length} chars (max 1024)`);
  if (d.length > 40 && !/\b(use|trigger|call|invoke)\b/i.test(d)) warn(rel(path), 'description does not say when to use the skill');
}

// ---- skill descriptions must not route to skills that are not installed --------
// A description is read by the router in every session; "use X instead" for a missing X is a dead end.
for (const dir of skills) {
  const fm = frontmatter(read(join(skillsDir, dir, 'SKILL.md'))) || {};
  const d = fm.description || '';
  const named = new Set();
  for (const m of d.matchAll(/\b(?:use|prefer|see)\s+(?:the\s+)?`?([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`?/gi)) named.add(m[1]);
  for (const m of d.matchAll(/\((?:use|prefer)\s+([^)]+)\)/gi)) {
    for (const part of m[1].split(/,|\bor\b|\band\b/)) {
      const name = part.trim().replace(/\s+instead$/, '');
      if (/^[a-z][a-z0-9-]+$/.test(name) && name.includes('-')) named.add(name);
    }
  }
  for (const name of named) {
    if (!skills.has(name) && !agents.has(name)) err(rel(join(skillsDir, dir, 'SKILL.md')), `description routes to "${name}", which is not installed`);
  }
}

// ---- cross references in harness-owned files --------------------------------
const OWN_SKILLS = ['retro', 'design', 'kickoff', 'discovery', 'agent-creator', 'blueprint', 'build', 'audit', 'deliver', 'bugfix', 'hotfix', 'prototype', 'amplify', 'harness-check'];
const owned = [join(root, 'CLAUDE.md'), join(root, 'AGENTS.md')];
const rulesDir = join(claude, 'rules');
const rules = existsSync(rulesDir) ? readdirSync(rulesDir).filter((f) => f.endsWith('.md')) : [];
for (const f of rules) owned.push(join(rulesDir, f));
for (const a of agents) owned.push(join(agentsDir, `${a}.md`));
for (const s of OWN_SKILLS) if (skills.has(s)) owned.push(join(skillsDir, s, 'SKILL.md'));
else err('.claude/skills', `pipeline skill "${s}" is missing`);
// Vendored skills rewritten for this harness: they name our sections, agents and paths, so they are checked like our own.
const ADAPTED_SKILLS = ['test-runner', 'test-generator', 'security-checker', 'lessons-writer'];
for (const s of ADAPTED_SKILLS) if (skills.has(s)) owned.push(join(skillsDir, s, 'SKILL.md'));

// A back-ticked `## Heading` in an instruction must be a section that exists: a heading of a template, or one listed here.
// Extend only with headings that exist somewhere real: Handoff (every agent file), Lessons learned and Verification (project section of CLAUDE.md).
const KNOWN_HEADINGS = ['Handoff', 'Lessons learned', 'Verification'];
// Compared without case and without a trailing qualifier: "Slices (T3 only)" → "slices", "Status: PLANNING" → "status".
const title = (h) => h.replace(/\s*(\(.*\)|:.*)$/, '').trim().toLowerCase();
const headings = new Set(KNOWN_HEADINGS.map(title));
const templatesDir = join(claude, 'templates');
for (const f of existsSync(templatesDir) ? readdirSync(templatesDir).filter((x) => x.endsWith('.md')) : []) {
  for (const m of read(join(templatesDir, f)).matchAll(/^#{1,6} +(.+?)\s*$/gm)) headings.add(title(m[1]));
}

const AGENT_WORDS = new Set(['agent']); // placeholders used in prose
const BUILTIN_COMMANDS = new Set(['skill', 'code-review', 'clear', 'compact', 'help', 'init', 'mcp']);

for (const path of owned) {
  if (!existsSync(path)) { err(rel(path), 'file missing'); continue; }
  const text = read(path);
  const file = rel(path);

  for (const m of text.matchAll(/(?<![\w/.])@([a-z][a-z0-9-]+)(?![\w-]*\/)/g)) {
    const name = m[1];
    if (AGENT_WORDS.has(name) || agents.has(name)) continue;
    err(file, `references unknown agent @${name}`);
  }
  for (const m of text.matchAll(/`\/([a-z][a-z0-9-]+)(?=[`\s])/g)) {
    const name = m[1];
    if (skills.has(name) || BUILTIN_COMMANDS.has(name)) continue;
    err(file, `references unknown skill /${name}`);
  }
  for (const m of text.matchAll(/`(\.claude\/[^`\s]+)`/g)) {
    const p = m[1].replace(/[.,;:]+$/, '');
    if (/[<*{]/.test(p)) continue;
    if (!existsSync(join(root, p))) err(file, `references missing path ${p}`);
  }
  for (const m of text.matchAll(/`## ([^`\n]+)`/g)) {
    if (/[<{]/.test(m[1]) || headings.has(title(m[1]))) continue;
    err(file, `references unknown section "## ${m[1]}" — fix: name a heading of a file in .claude/templates/, or add a heading that really exists to KNOWN_HEADINGS in scripts/validate-harness.mjs`);
  }
}

// ---- rules index in CLAUDE.md ----------------------------------------------
const claudeMd = existsSync(join(root, 'CLAUDE.md')) ? read(join(root, 'CLAUDE.md')) : '';
for (const f of rules) if (!claudeMd.includes(f)) err('CLAUDE.md', `rules index does not list ${f}`);

// ---- roster in AGENTS.md ----------------------------------------------------
const agentsMd = existsSync(join(root, 'AGENTS.md')) ? read(join(root, 'AGENTS.md')) : '';
const rosterSection = (agentsMd.split(/^## Roster/m)[1] || '').split(/^## /m)[0];
const roster = new Set([...rosterSection.matchAll(/^\| `@([a-z0-9-]+)`/gm)].map((m) => m[1]));
for (const a of agents) if (!roster.has(a)) err('AGENTS.md', `roster is missing @${a}`);
for (const r of roster) if (!agents.has(r)) err('AGENTS.md', `roster lists @${r} but no agent file exists`);
for (const a of agents) if (!claudeMd.includes(`@${a}`)) warn('CLAUDE.md', `team line does not mention @${a}`);

// ---- always-loaded budget ------------------------------------------------------
let alwaysBytes = Buffer.byteLength(claudeMd.split(/^# Project[ \t]*\r?$/m)[0]);
for (const f of rules) alwaysBytes += statSync(join(rulesDir, f)).size;
if (alwaysBytes > MAX_ALWAYS_BYTES) err('CLAUDE.md + .claude/rules', `always-loaded constitution+rules is ${alwaysBytes} B (max ${MAX_ALWAYS_BYTES}) — fix: cut text from a rule or the constitution, or raise MAX_ALWAYS_BYTES in scripts/validate-harness.mjs on purpose`);
if (budget > MAX_DESC_CHARS) err('.claude/agents + .claude/skills', `always-loaded descriptions total ${budget} chars (max ${MAX_DESC_CHARS}) — fix: shorten an agent or skill description, or raise MAX_DESC_CHARS in scripts/validate-harness.mjs on purpose`);

// ---- settings ---------------------------------------------------------------
const settingsFiles = [join(claude, 'settings.json'), join(claude, 'templates', 'settings.harness.json')].filter(existsSync);
for (const p of settingsFiles) {
  try { JSON.parse(read(p)); } catch (e) { err(rel(p), `invalid JSON: ${e.message}`); }
}
if (!settingsFiles.length) err('.claude', 'no settings.json and no templates/settings.harness.json');
if (!existsSync(join(claude, 'settings.json'))) {
  warn('.claude/settings.json', 'not active — copy .claude/templates/settings.harness.json to enable permissions and the SessionStart hook');
}

// Harness repo only: the active settings and the template that installs must grant the same permissions.
const activeSettings = join(claude, 'settings.json');
const templateSettings = join(claude, 'templates', 'settings.harness.json');
if (existsSync(join(root, 'install.ps1')) && existsSync(activeSettings) && existsSync(templateSettings)) {
  const permissions = (p) => {
    try { return JSON.parse(read(p)).permissions ?? {}; } catch { return {}; } // invalid JSON is reported above
  };
  const [active, template] = [permissions(activeSettings), permissions(templateSettings)];
  const list = (perms, kind) => (Array.isArray(perms[kind]) ? perms[kind].filter((x) => typeof x === 'string') : []);
  const normalise = (item) => item.replace(/(?::| )\*\)$/, ' *)');
  const diff = [];
  for (const kind of ['allow', 'ask', 'deny']) {
    const a = new Set(list(active, kind).map(normalise));
    const t = new Set(list(template, kind).map(normalise));
    for (const x of a) if (!t.has(x)) diff.push(`${kind} only in settings.json: ${x}`);
    for (const x of t) if (!a.has(x)) diff.push(`${kind} only in the template: ${x}`);
  }
  if (diff.length) warn('.claude/settings.json', `permissions differ from .claude/templates/settings.harness.json (${diff.join('; ')}) — fix: make both files grant the same permissions`);
  const all = ['allow', 'ask', 'deny'].flatMap((kind) => [...list(active, kind), ...list(template, kind)]);
  if (all.some((x) => x.endsWith(':*)')) && all.some((x) => x.endsWith(' *)'))) {
    warn('.claude/settings.json', 'two permission wildcard syntaxes in use (":*)" and " *)") — fix: verify which form the installed Claude Code honours and use it in both settings files');
  }
}

// ---- scripts the rules and skills call ---------------------------------------
for (const s of ['incident.mjs', 'validate-task.mjs', 'validate-harness.mjs', 'task-diff.mjs', 'gate.mjs']) {
  if (!existsSync(join(root, 'scripts', s))) err(`scripts/${s}`, 'script referenced by the harness is missing');
}

// ---- report -----------------------------------------------------------------
console.log(`Harness: ${agents.size} agents · ${skills.size} skills · ${rules.length} rules · always-loaded: constitution+rules ${alwaysBytes} B (≈${Math.round(alwaysBytes / 4)} tok, max ${MAX_ALWAYS_BYTES}) · descriptions ${budget} ch (≈${Math.round(budget / 4)} tok, max ${MAX_DESC_CHARS})`);
for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`Validator: ${errors.length ? 'FAIL' : 'PASS'} (${errors.length} errors, ${warnings.length} warnings)`);
process.exit(errors.length ? 1 : 0);
