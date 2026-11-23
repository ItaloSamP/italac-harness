---
name: bugfix
description: Root-cause bug workflow — reproduce, find the cause with evidence, minimal fix, regression test, review, deliver. Use when something is broken, behaves wrongly, crashes, regressed or is flaky, and it is not a production emergency (that is /hotfix). Triggers - "fix this bug", "it's not working", "this is broken", "why does X happen", an error message or stack trace pasted in.
---

# Bugfix — cause first, then fix

**Input:** `$ARGUMENTS` — symptom, error, issue number, or failing test.

## 1. Capture the raw evidence
The exact error/stack, the input, the environment, when it started. Ask the user for nothing you can get yourself (logs, `git log`, running it).

## 2. Size it

| Situation | Route |
|-----------|-------|
| Cause visible in ≤ 2 files after reproducing | **Inline** (steps 3–6) |
| Cause unknown, intermittent, cross-module, or first inline attempt failed | **`@debugger`** with the evidence, repro command and scope |
| "It worked before" | `@debugger` (will `git bisect`) |

## 3. Reproduce
Smallest command that shows the failure. Turn it into a **failing test** — this is the regression test and the proof.

## 4. Root cause
State it as: *X happens because Y at `path:line`, triggered when Z.* Confirm by toggling the cause. No confirmed cause → no fix; go to `@debugger`.

## 5. Fix
Minimal change at the cause. The failing test now passes. Run scoped tests around the area. Grep for the same pattern elsewhere — report, fix only if trivial and in scope.

## 6. Close
- Task file `.specs/tasks/task-fix-<slug>.md`, `Status: IN_REVIEW` (short form, three sections: `## Problem` = symptom + root cause, `## Acceptance criteria` = regression test passes + original repro passes, `## Files` = the changed files). When the file is created: `node scripts/task-diff.mjs <task-file> --init`. T1 one-liners may skip the file.
- Non-obvious cause → `/lessons-writer`.
- `/audit` → `/deliver`.

## Never
Fix a symptom without a cause · catch-and-ignore · add sleeps/retries · weaken or skip a test · bundle refactors into the fix.

## Output

```
Bug: <symptom>
Root cause: <X because Y at path:line>
Fix: <path:line — what>
Regression test: <path> (failed before → passes)
Same pattern elsewhere: <paths | none>
→ auditing now
```
