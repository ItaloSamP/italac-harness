---
name: hotfix
description: Expedited path for production emergencies — production down or degraded, active security vulnerability, data loss or corruption, or the user explicitly says URGENT/HOTFIX. Skips full planning, keeps the safety gates that matter - reproduction, minimal fix, regression test, scoped tests, review. Not for feature requests or ordinary bugs (use /bugfix).
---

# Hotfix — fast, minimal, still safe

Speed comes from cutting scope and ceremony, never from cutting proof.

## What is skipped vs kept

| Skipped | Kept |
|---------|------|
| Full `/blueprint` | Minimal task file `.specs/tasks/task-hotfix-<slug>.md` |
| Full-suite gate (waived by default) | Tests of touched files + new regression test |
| Multi-reviewer panel before commit | `@code-reviewer` on the fix diff (parallel with commit prep) |
| Context doc sweep | One `GOTCHAS.md` entry via `/lessons-writer` |

## Steps

1. **Acknowledge and stabilise.** Is there a faster mitigation than a code fix (rollback, feature flag, config)? If yes, propose it first — rollback/deploy is Level C: ask once, clearly.
2. **Minimal task file** `.specs/tasks/task-hotfix-<slug>.md`: symptom · impact · suspected cause · AC (repro no longer fails; regression test passes).
3. **Reproduce** (or capture the production evidence if reproduction is impossible; say so).
4. **Root cause** — inline if obvious; otherwise `@debugger` immediately, do not burn time guessing.
5. **Minimal fix + regression test.** No refactors, no "while we're here".
6. **Scoped checks:** touched-file tests, typecheck; `/security-checker` if the incident is security-related.
7. **Review + commit in parallel:** `@code-reviewer` on the diff; `@committer` with `GATE WAIVED BY USER` only if the user said this is a hotfix/urgent — branch `hotfix/<slug>`, commit `fix!:` or `fix:`.
8. **Release:** push/PR/deploy need approval (Level C) — ask once, with the diff summary and rollback plan.
9. **After the fire:** task file → follow-ups section (full-suite run, proper fix if this was a patch, monitoring gap). Record the lesson.

## Output

```
Hotfix: <incident>
Cause: <path:line — why>
Fix: <what> · Regression test: <path>
Checks: <cmd → result> · Review: <verdict>
Committed: hotfix/<slug> (<hash>) — awaiting approval to push/deploy
Follow-ups: <list>
```
