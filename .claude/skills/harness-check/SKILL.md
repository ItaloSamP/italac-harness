---
name: harness-check
description: Validate this agent harness itself — runs the structural validator (frontmatter, names, broken references between rules, agents and skills) and optionally a deeper usefulness evaluation. Use after adding or editing any rule, agent or skill, before committing harness changes, or when the user says "check the harness", "validate agents", "is the workflow consistent".
---

# Harness check — the harness has tests too

## 1. Structural validation (always)

```bash
node scripts/validate-harness.mjs
```

It checks, and exits non-zero on any error:

- every `.claude/agents/*.md` has `name` (matching the filename), `description`, and a `## Handoff` block;
- every `.claude/skills/*/SKILL.md` has `name` (matching the directory) and a `description`;
- every `@agent` mentioned in rules, agents, harness skills, `CLAUDE.md` and `AGENTS.md` exists;
- every `/skill` mentioned in those files exists (or is a known built-in);
- every `.claude/...` path mentioned exists;
- the roster in `AGENTS.md` lists every agent, and nothing that does not exist.

Fix every error. Warnings are judgement calls — fix or justify. Open incidents: `node scripts/incident.mjs open` (rule `.claude/rules/85-self-improvement.md`).

## 2. Change rules for the harness

| Adding | Do |
|--------|----|
| An agent | `/agent-creator` → file in `.claude/agents/` with Hard rules, Method, Output + Handoff block → add to `AGENTS.md` roster and to the help table in `.claude/rules/20-delegation.md` if others should call it |
| A skill | `/skill-architect` → `.claude/skills/<name>/SKILL.md`; description says what it does **and when to use it**; keep SKILL.md lean, push detail to `references/` |
| A rule | New numbered file in `.claude/rules/`; one topic per file; lower number = higher precedence; add it to the index in `CLAUDE.md` |

One source of truth per fact: a policy lives in a rule; agents and skills point to it instead of restating it.

## 3. Behavioural evaluation (on request)

Structure passing does not mean agents behave. Agent changed → re-run its scenarios in `evals/agents/<name>.md`. None exists → first write one scenario that reproduces the incident (`/agent-creator` step 8), see it fail, then fix. After larger edits, dispatch `@explorer` with the drift brief in `evals/agents/explorer.md`: every place two files state the same policy differently, and every dangling reference.

## Output

```
Harness: <n> agents · <n> skills · <n> rules
Validator: PASS | FAIL (<n> errors, <n> warnings)
<errors, one per line: file — problem>
```
