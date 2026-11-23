---
name: kickoff
description: Runs a large project or initiative through its full lifecycle — discovery, prototype, design, architecture, roadmap, foundation, then milestone-by-milestone build — with one artifact and one gate per phase and a state file so work survives across sessions. Use when starting a new product, a new system, a rewrite, or anything too big for a few task files ("vamos criar um sistema de…", "novo projeto", "start a project"), and to resume one ("continue the project", "onde paramos"). Do NOT use for a single feature (use /blueprint) or a quick experiment (use /prototype).
---

# Kickoff — large work, phase by phase

A large project fails in the gaps between phases: building before the problem is clear, designing before anything was tried, coding before the architecture was decided. Here each phase answers one question, leaves one artifact, and passes one gate.

**State lives in `.specs/STATE.md`** (template: `.claude/templates/state.md`). Update it at every phase or milestone change. A new session reads it and continues — never rely on the conversation.

**Resuming:** if `.specs/STATE.md` exists, read it and `.specs/ROADMAP.md`, report where things stand in three lines, and continue from the current phase.

**Plan preview (not a stop):** three lines — phases that will run and which are skipped, expected number of roadmap items, reviewers per item — and the leaner alternative. Then proceed.

## Phases

| # | Phase | Question it answers | Who | Artifact | Gate |
|---|-------|--------------------|-----|----------|------|
| 1 | **Discovery** | What are we building, for whom, and what is out? | `/discovery` (Maestro + `@product-manager`, `@researcher`) | `.specs/docs/prd-<slug>.md` | User confirmed the v1 cut |
| 2 | **Prototype** | Does the core idea work and look right before we invest? | `/prototype` (`@designer` for UI, a spike for technical risk) | `prototypes/<slug>/` + `NOTES.md` | The riskiest assumption has evidence; the user saw it when it is visual |
| 3 | **Design** | What are the flows, screens and states, and what is the one design system? | `@designer` running `/design` | `.specs/docs/design-<slug>.md` + `context/DESIGN.md` | Every PRD flow has its screens and states; one design system recorded; engine chosen per surface |
| 4 | **Architecture** | How is it built, and what is decided for good? | `@tech-lead` (+ `@security-auditor` for the threat model, `@researcher` for stack facts, `@ai-engineer` when the product has LLM features) | `.specs/docs/spec-<slug>.md`, ADRs in `context/DECISIONS.md`, threat model | Stack, data model, contracts and module boundaries decided, each with a verification plan |
| 5 | **Roadmap** | In what order, in which slices? | Maestro + `@tech-lead` | `.specs/ROADMAP.md` (template: `.claude/templates/roadmap.md`) | Milestone 1 is a walking skeleton; every milestone is demoable with exit criteria |
| 6 | **Foundation** | Can the team build and prove things here? | `@devops`, `/context-generator` | Scaffold, CI, test runner, lint/typecheck, `context/*.md`, commands in `CLAUDE.md` | A trivial change passes `/build` → `/audit` → `/deliver` green |
| 7 | **Build loop** | — | per milestone, below | Task files, code, tests | Milestone exit criteria proven |
| 8 | **Release** | Is it shippable and operable? | `@devops`, `@tech-writer`, `@qa-engineer` | Deploy config, README and guides, regression run | Level C approval for the deploy itself |

Skip a phase only when its question is already answered — record which and why in `STATE.md`. Small-but-new projects usually merge 3 into 2 and keep 4 to a one-page spec.

## Phase rules

- **Order matters:** discovery → prototype → design → architecture. Prototypes are thrown away; their *learning* feeds design and architecture.
- **Roadmap shape:** milestone 1 is the thinnest end-to-end path through every layer. Later milestones add vertical slices of user value — never "all the backend, then all the frontend".
- **Each roadmap item** becomes one task file: outcome, acceptance signal, dependencies, size (S/M/L). L items are split before they are built.
- **Decisions are recorded once** as ADRs; later phases cite them and do not reopen them without new evidence.

## Build loop (phase 7), per milestone

1. Take the milestone's items from `ROADMAP.md`; `/blueprint` each into a task file.
2. `/build` — independent task files fan out to parallel `@developer`s; hot files stay with the Maestro (`.claude/rules/20-delegation.md`).
3. `/audit` each, then `/deliver` (local commits; push/PR per standing instruction).
4. **Milestone review:** `@qa-engineer` runs the milestone's end-to-end flows; run the full suite; compare with the exit criteria.
5. Update `ROADMAP.md` (done / changed / added), `STATE.md`, context docs. Run `/retro` only if `node scripts/incident.mjs open` lists incidents.
6. Report to the user — one final-report message per milestone — and continue to the next unless a Level C decision is open.

Re-plan when reality disagrees with the roadmap: change `ROADMAP.md` and log why. Scope *additions* that change the product go back to the user.

## User checkpoints (the only planned stops)

1. End of Discovery — confirm the v1 cut.
2. End of Prototype — when the result is visual or changes direction.
3. Any Level C action (`.claude/rules/30-autonomy.md`): push/PR without a standing instruction, deploy, paid services, secrets.

Everything else proceeds without asking.

## Output (at each phase change)

```
Project: <name> — phase <n> <name> ✔ → phase <n+1>
Artifact: <path>
Decided: <key decisions, one line each>
Open (user-owned): <or none>
State: .specs/STATE.md
```
