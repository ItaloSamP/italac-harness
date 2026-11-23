---
name: deliver
description: Final step of the pipeline — confirms the Definition of Done, dispatches @committer for the full gate and atomic local commits on a feature branch, then asks once for merge/push/PR approval and finishes the release. Use after /audit, or when the user says "commit", "ship", "deliver", "open a PR", "push".
---

# Deliver — commit locally, release on approval

**Input:** `$ARGUMENTS` — task file path, or empty (Mode B: commit the current working changes).

## 1. Pre-flight (Maestro)
- Task file is `READY_TO_COMMIT` (T2+). If not → run `/audit` first.
- `git status`: identify task files vs unrelated changes. Unrelated changes are left alone.
- No repo yet (`git rev-parse` fails) → `git init` is Level A; do it and say so.

## 2. Local commits — `@committer`

```
GOAL: Gate <task>, commit it as one commit on its task branch and land it on the local base branch.
CONTEXT: task file <path>; base <main>; standing instructions from CLAUDE.md project section
SCOPE: git operations + task file status
OUT OF SCOPE: push, PR, tag, branch deletion (not approved yet)
DONE WHEN: gate green, one commit, merged into the local base, task file = SHIPPED with `merged into <base> @<hash>`
```

Gate red → back to `/build` fix pass with the failures, then `/audit` the fix, then return here.

## 3. Remote decision (the one possible stop)
Local landing already happened in step 2 — it is the solo default and needs no question. What is left is the remote. Decide in this order:
- **`git remote` prints nothing →** done; never ask about push or PR.
- **A standing instruction in the project section of `CLAUDE.md` covers it** ("always push when green", "open PR automatically") **→** step 4 with exactly what it approves, no question.
- **Standing instruction "collaboration mode" →** step 2 runs with `COLLABORATION MODE` in the brief (layered commits, no local merge) and the question below asks about push + PR.
- **Otherwise →** ask once:

  > Está na `<base branch>` local (gate verde). Faço push? — recomendado: sim. Quer que vire o padrão deste projeto?

  A yes to the second question is written under Standing instructions. While waiting, nothing else is blocked — report and end the turn.

## 4. Push / PR — `@committer` again
Brief carries `APPROVED: push` and/or `APPROVED: pr`, quoting the user's words or the standing instruction. Task file → `SHIPPED` with the PR URL, or `merged into <base> @<hash>`.

After a PR exists: failing checks → `@devops` with `/gh-fix-ci`; review comments → `/gh-address-comments`.

## 5. Learn
`node scripts/incident.mjs open` — incidents logged during this task with a clear cause are fixed now (rule 85); two or more open, or any recurring → run `/retro` before the final report.

## 6. Final report
Template: `.claude/rules/90-communication.md` rule 2. Here `Evidence` carries the gate result and the audit verdicts, and `Where it lives` the branch, the commit and whether it was merged, pushed or is local only.
