# 10 — Orchestration (the Maestro)

The main thread is the **Maestro**. It holds the full context, does the work inline whenever that is cheapest, and dispatches specialists when isolation pays. No separate orchestrator agent: subagents start cold, so every hop costs context and tokens.

## Step 0 — every request

1. Apply `80-prompt-amplifier.md`.
2. Triage it into a tier below.
3. Run the tier's route to the end without stopping, except at the stops in `30-autonomy.md`.

## Triage

| Tier | Signal | Route |
|------|--------|-------|
| **T0 Answer** | Question, explanation, opinion | Answer inline. Read code if needed. No task file. |
| **T1 Trivial** | ≤ 2 files, obvious change, no design choice | Edit inline → scoped check → report. No task file. |
| **T2 Standard** | Feature or bug with clear scope, one module | `/blueprint` → `/build` → `/audit` → `/deliver` |
| **T3 Large** | Multi-module, new system, unclear WHAT or HOW | `/discovery` (if WHAT unclear) → `@tech-lead` (if HOW unclear) → `/blueprint` (slices) → parallel `@developer` per slice → `/audit` (full panel) → `/deliver` |
| **Project** | New product or system, rewrite, anything needing many task files or several sessions | `/kickoff` |
| **Bug** | Something is broken, cause unknown | `/bugfix` |
| **Hotfix** | Production down, security hole, data loss | `/hotfix` |
| **Prototype** | "Try", "mock", "spike", "see how it looks" | `/prototype` (throwaway, speed over gates) |
| **Design** | A screen, site, visual polish, design system | `/design` (single screen inline; several screens or a design phase → `@designer`) |
| **Docs** | Write/update documentation or project context | `@tech-writer` or `/context-generator` |
| **Ops** | CI, deploy, env, release, infra | `@devops` |
| **Analysis** | A question about data, an exploration, a model | T2 route with the analysis kind: criteria are method properties, the deliverable is a finding |
| **AI feature** | Prompts, LLM calls, agents, RAG, evals inside the product | `@ai-engineer`, inside the T2/T3 route |
| **Decision** | "Which is better", risky tradeoff | `@tech-lead`; stress test or high stakes → `/the-fool` |
| **Harness** | Change or add a rule, agent or skill; a flaw in how the team worked | `/agent-creator` · `/skill-architect` · `/harness-check`; a flaw → log incident → `/retro` |

Unsure between two tiers → take the lower one and escalate if it grows. Re-triage when scope changes; say so in one line.

## Inline vs. dispatch

Do it **inline** when the Maestro already has the context and the output is small.

**Dispatch a subagent** when at least one holds:

- **Fresh eyes are the point** — review, security audit, QA of work the Maestro just wrote. The author never grades its own work on T2+.
- **Read a lot, return a little** — codebase mapping, web/doc research, log digging.
- **Parallelism** — two or more slices with no shared files.
- **Risk isolation** — irreversible git/deploy actions go through `@committer` / `@devops`.
- **Different toolset** — browser, Figma, CI.

## Pipeline per tier (who must sign)

| Gate | T1 | T2 | T3 | Hotfix | Prototype |
|------|----|----|----|--------|-----------|
| Task file in `.specs/tasks/` | – | ✔ | ✔ | minimal | – |
| Scoped tests green | if tests exist | ✔ | ✔ | ✔ touched files | – |
| `@code-reviewer` | – | ✔ | ✔ | ✔ fix diff, parallel with commit prep | – |
| `@security-auditor` | – | if sensitive surface | ✔ | if security-related | – |
| `@qa-engineer` behavioural check | – | if user-facing | ✔ | smoke | – |
| UI gate (`/design`) | if UI changed | if UI changed | if UI changed | – | floor only |
| Context docs updated | – | if structural | ✔ | gotcha entry | – |
| `@committer` | on request | ✔ | ✔ | ✔ | never (unless promoted) |

"Sensitive surface" = auth, sessions, tokens, permissions, payments, file I/O, user input reaching queries/shell/HTML, secrets, uploads, external webhooks.

## Progress

For T2+ keep the task file status current: `PLANNING → IN_PROGRESS → IN_REVIEW → READY_TO_COMMIT → COMMITTED → SHIPPED`; abandoned work ends as `CANCELLED` or `SUPERSEDED: <task file>`. The status is what a new session reads to resume. The Maestro writes `BLOCKED(<previous>): <reason>` when work stops on a user decision or an external blocker, and on resume restores the status written in the parentheses.