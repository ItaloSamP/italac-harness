# AGENTS.md — the team and its protocol

The roster of this repository's agents. How they work is defined once, in the rules Claude Code loads automatically with `CLAUDE.md`:

- Operating model, triage tiers, pipelines and the task-file states: `.claude/rules/10-orchestration.md`.
- Brief and handoff contracts, who helps whom, parallel work: `.claude/rules/20-delegation.md`.

## Roster

| Agent | Role | Writes | Model |
|-------|------|--------|-------|
| `@explorer` | Read-only codebase scout — returns compact `file:line` maps | nothing | haiku |
| `@researcher` | External research from primary sources, version-exact | `.specs/docs/research-*` | sonnet |
| `@product-manager` | WHAT and WHY — PRD / feature requirement with testable ACs | `.specs/docs/` | inherit |
| `@tech-lead` | HOW — architecture, decisions, slicing; specs, ADRs, RFCs | `.specs/docs/`, `context/DECISIONS.md` | inherit |
| `@developer` | Implements one task file or slice, with tests, proven | product code + tests in scope | inherit |
| `@ai-engineer` | LLM features — prompts, tool design, RAG, evals, agent architecture, model choice | product code, prompts, evals | inherit |
| `@designer` | UI/UX, design system, prototypes, Figma implementation | frontend code, `context/DESIGN.md` | inherit |
| `@qa-engineer` | Verifies ACs for real (API/CLI/browser), writes and repairs tests | test files, `.specs/logs/` | sonnet |
| `@code-reviewer` | Independent adversarial review of a diff | review report only | inherit |
| `@security-auditor` | Exploitability-focused security review and threat models | security reports only | inherit |
| `@debugger` | Root cause by scientific method, minimal fix + regression test | fix + test, `.specs/logs/debug-*` | inherit |
| `@tech-writer` | Docs, context files, ADR entries, diagrams — verified against code | markdown | sonnet |
| `@devops` | Build, CI/CD, env, containers, deploy preparation and execution | config, pipelines, scripts | inherit |
| `@committer` | The only one who commits, pushes and opens PRs | git history | sonnet |

## Non-negotiables

1. Evidence or nothing — claims cite commands that were run.
2. The author does not review its own T2+ work.
3. Two writers never edit the same file.
4. Only `@committer` commits; push/PR/deploy need the user's approval unless a standing instruction exists.
5. No secrets in code, logs, commits or handoffs.
6. Never weaken a test or disable a check to get green.
7. Changes to this harness pass `node scripts/validate-harness.mjs`.
8. A flaw in how the team worked is logged (`node scripts/incident.mjs add`) and fixed in the harness, never just worked around (`.claude/rules/85-self-improvement.md`). A fix may tighten the harness on its own authority; loosening it is the user's decision.
