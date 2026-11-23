---
name: audit
description: Independent quality gate for finished work — dispatches @code-reviewer, plus @security-auditor and @qa-engineer when the change warrants, in parallel; runs the fix loop until no BLOCKER/MAJOR remains; marks the task READY_TO_COMMIT. Use after /build, before any commit, or when the user says "review this", "audit", "is this ready". The author never reviews its own work here.
---

# Audit — fresh eyes before commit

**Input:** `$ARGUMENTS` — task file path, or empty (ad-hoc: `node scripts/task-diff.mjs --base HEAD`).

## 1. Decide the panel

First, produce the diff the panel will read: `node scripts/task-diff.mjs <task-file>`. Exit 2 (empty diff) → do not dispatch; return to `/build`. Files it lists as `outside ## Files` are either added to the task file's `## Files` (then re-run the script) or named as unrelated in the brief.

| Reviewer | When |
|----------|------|
| `@code-reviewer` | Always |
| `@security-auditor` | Sensitive surface touched (auth, tokens, permissions, payments, file I/O, uploads, input → query/shell/HTML, secrets, webhooks), or T3 |
| `@qa-engineer` | User-facing behaviour changed, or T3, or ACs that need a real run (API/CLI/browser) |
| `@designer` (review brief) | UI is the deliverable: runs the UI gate from `/design` step 6 against the built screens |

Dispatch the whole panel **in one message** (parallel). Each brief:

```
GOAL: Review <task> independently and return a verdict.
CONTEXT: task file <path>; diff file <path>; changed outside ## Files: <list>; context docs <list>
SCOPE: READ-ONLY (qa-engineer: test files only)
OUT OF SCOPE: fixing product code
DONE WHEN: verdict + findings as path:line — severity — problem — fix
```

## 2. Consolidate
Merge findings, drop duplicates, keep the highest severity. Disagreement between reviewers → the stricter one stands unless you can disprove it with a run.
Append a dated line per reviewer verdict to the task file `## Log`.

## 3. Fix loop
- Any `BLOCKER`/`MAJOR` → fix (inline, or `@developer` for a large/isolated fix) → re-run `task-diff.mjs <task-file>` → re-dispatch **only the reviewer(s) who raised them**, with the new diff file, its `changed since` list and the findings to re-check.
- `MINOR` → fix if cheap, else record in the task file.
- Round limit and escalation: the fix loop in `.claude/rules/40-quality-gates.md`.
- A finding you believe is wrong: disprove it with evidence (a test, a run) and log it — never ignore silently.

## 4. Close
More than one fix round, or a finding that `/build` self-verification should have caught → log an incident (`.claude/rules/85-self-improvement.md`).

All verdicts clean → check the Definition of Done (`.claude/rules/40-quality-gates.md`) line by line → set `Status: READY_TO_COMMIT` → run `/deliver <task-file>`.

PR-level review on GitHub with inline comments: the optional `the-judge` skill, if installed; without it this `/audit` is the review.

## Output

```
Audit: <task> — READY_TO_COMMIT | CHANGES_REQUIRED (round n)
code-reviewer: APPROVED (0B/0M/2m)
security-auditor: PASSED | PASSED_WITH_NOTES | n/a
qa-engineer: PASS 6/6 | n/a
Fixed this round: <list>
Accepted risks: <MINORs recorded>
→ delivering now
```
