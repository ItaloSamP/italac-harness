---
name: build
description: Implement a task file (or a clear request) to a proven state — test triage, code, tests, security spot-check, self-verification, context doc updates. Runs inline for a single slice and fans out to parallel @developer agents for multi-slice task files. Use after /blueprint, or when the user says "implement", "build", "code this". Hands off to /audit automatically.
---

# Build — implement and prove

**Input:** `$ARGUMENTS` — task file path (preferred) or description. No task file and the work is T2+ → run `/blueprint` first.

Set the task file `Status: IN_PROGRESS` first, in either mode, then `node scripts/task-diff.mjs <task-file> --init` (records the commit this task starts from; `/audit` diffs against it).

## Mode selection

| Task file has | Mode |
|---------------|------|
| No slices / one slice | **Inline** — the Maestro builds (full context, no cold start) |
| 2+ independent slices | **Fan-out** — one `@developer` per parallel slice, in one message; dependent slices after their prerequisite returns |

Fan-out brief per developer: `GOAL` (slice outcome) · `CONTEXT` (task file path + slice ID + relevant context docs) · `SCOPE` (that slice's files only) · `OUT OF SCOPE` (other slices' files, commits) · `DONE WHEN` (slice ACs with evidence).

## Inline steps

### 0. Load
Read `CLAUDE.md` project section (commands), `context/GOTCHAS.md`, the context docs the task touches. Follow `/coding-guidelines`.

### 1. Test triage — before any code
Fill the task file's triage table per `.claude/rules/70-testing.md`. Bug fix → write the failing test now.

### 2. Implement
Read only the files to change. Minimal diff, existing conventions. Typecheck/lint as you go.
- UI work with visual weight → `/design` (it picks the engine and runs the UI gate); several screens or a design phase → `@designer`.
- LLM or agent feature → `@ai-engineer`.
- Unfamiliar code beyond a few files → `@explorer` first.

### 3. Tests
`/test-generator` for each `YES` row. Then `/test-runner` (scoped).

### 4. Security spot-check
Sensitive surface touched → `/security-checker` on changed files. Fix findings now.

### 5. Self-verify (all must hold)
- [ ] Typecheck / lint / build pass — command output seen
- [ ] Scoped tests pass — command output seen
- [ ] Each AC exercised for real where possible (HTTP call, CLI run, browser) — evidence written next to the AC
- [ ] `git diff` re-read: no debug code, no unrelated changes, no leftovers

### 6. Help rules (do not spin)
Same failure twice → `@debugger`. Design wall → `@tech-lead`. Unknown API → `@researcher`. Full table: `.claude/rules/20-delegation.md`.

### 7. Context docs
Update per `.claude/rules/75-context-docs.md`. Non-obvious discovery → `/lessons-writer`. More than a few lines → `@tech-writer`.

### 8. Hand to audit
Set `Status: IN_REVIEW` and run `/audit <task-file>`.

## After a fan-out

1. Read every handoff. Dispatch any `NEEDS`. Apply each `INTEGRATION:` change to the hot files yourself. You are the only writer of the task file: write each slice's AC evidence into it and append one `## Log` line per returned slice and per applied `INTEGRATION:` change.
2. Integrate: run typecheck + the union of scoped tests on the combined tree. Conflicts or integration failures → fix inline (you have the full picture).
3. Continue at step 7.

## Fix pass (after audit findings or test failures)
Fix only the listed findings → re-run the affected checks → return to the same reviewer for the fix diff. Do not re-implement.

## Output

```
Build: <task file> — IN_REVIEW
Files: <path (+a/−b)> …
Triage: <symbol → YES tested | NO skipped>
Evidence: <typecheck cmd → ok> · <test cmd → N passed>
Deviations: <or none>
→ auditing now
```
