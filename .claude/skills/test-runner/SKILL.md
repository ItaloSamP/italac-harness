---
name: test-runner
description: Runs only the tests in scope for the current task (from the task file Test scope section, or matching the changed files) and reports pass/fail with exact failures. Use after writing code or tests, during /build and /bugfix, or when the user says "run the tests", "roda os testes". Never runs the full suite unless explicitly asked — that is the @committer gate.
---
## Test Runner

### Step 1: Determine scope
1. Task file exists → read `## Test scope` → use those exact paths
2. No task file → `git diff --name-only HEAD` → find matching test files
3. Neither → report `no scope found` and run nothing

**Never run the full suite unless explicitly requested.**

### Step 2: Get test commands
Read the Commands table in the project section of `CLAUDE.md` for stack-specific test commands and any Node/runtime version requirements.

### Step 3: Run scoped tests

Use the commands from CLAUDE.md. Run only the files from Step 1.

### Step 4: Report

```
## Test Results: PASS | FAIL
Scope: <files>
Total: N | Passed: N | Failed: N

Failures:
1. file.test.ts:45 — "test name" — Expected X got Y
```

Pre-existing failures → see `context/TESTING-POLICY.md`. Do NOT re-investigate.

**Gate:** 100% of scoped tests must pass before proceeding to `@committer`.
The full suite is not run here; that is the `@committer` gate.
