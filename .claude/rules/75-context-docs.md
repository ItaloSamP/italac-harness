# 75 — Project context and memory

Context files are the team's long-term memory; keeping them true is part of the work.

## Read (before acting)

| Doing | Read first |
|-------|-----------|
| Anything in an existing project | `CLAUDE.md` project section, `context/GOTCHAS.md` |
| Adding/changing routes | `context/API.md` |
| Touching persistence | `context/DATA_MODEL.md` |
| Creating files/folders | `context/FOLDER_ARCH.md` |
| UI work | `context/DESIGN.md` |
| Questioning an existing design choice | `context/DECISIONS.md` |
| Env/config | `context/ENVIRONMENT.md` |

Read only what the task touches; for breadth dispatch `@explorer`.

No `context/` and the repository has code, on a T2+ task → `/context-generator --quick` without interviewing (infer; write only files with real content; list assumptions in the report), then the adoption steps in `.claude/skills/build/references/verification.md` (Level A).

## Write (before calling it done)

| Changed | Update |
|---------|--------|
| Route added/removed/changed | `context/API.md` |
| Schema change | `context/DATA_MODEL.md` |
| New folder or file convention | `context/FOLDER_ARCH.md` |
| New layer, component, data flow | `context/ARCH.md` |
| New token or UI pattern | `context/DESIGN.md` |
| Architectural decision | `context/DECISIONS.md` (ADR entry) + `.specs/docs/adr-NNN-*.md` when substantial |
| Non-obvious pitfall discovered | `/lessons-writer` → `context/GOTCHAS.md` |
| New env var | `context/ENVIRONMENT.md` |
| Dev/test command changed | `CLAUDE.md` project section |

Nothing structural changed → skip, and do not invent entries.

## Lessons

Record a lesson only when it would surprise a senior engineer new to this project: a stack limitation, an environment quirk, a decision and its reason, a correction from the user.

## `.specs/` hygiene

- One task file per unit of work: `.specs/tasks/task-<slug>.md`.
- Documents: `.specs/docs/<type>-<slug>.md` where type ∈ `prd`, `feature-requirement`, `spec`, `rfc`, `adr-NNN`, `research`, `eval`, `threat-model`, `review`, `design`.
- Logs and raw evidence: `.specs/logs/` (git-ignored).
- Finished task files stay; they are the project's history.

## Large projects

`/kickoff` keeps `.specs/STATE.md` and `.specs/ROADMAP.md`. Update `STATE.md` at every phase or milestone change and before ending a turn mid-project. A new session reads `STATE.md` first.
