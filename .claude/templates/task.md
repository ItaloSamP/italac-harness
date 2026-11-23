# Task: <title>

## Status: PLANNING
<!-- PLANNING → IN_PROGRESS → IN_REVIEW → READY_TO_COMMIT → COMMITTED → SHIPPED | BLOCKED(<previous>): <reason> | CANCELLED | SUPERSEDED: <task file> -->
<!-- Base: written once by scripts/task-diff.mjs --init -->

## Source
<user request (quoted) | GitHub issue #N | .specs/docs/<doc>.md>

## Proof
<external oracle: what proves the result besides us — test suite, type checker, validator, real response, reconciliation>

## Problem
<1–2 concrete paragraphs. What breaks or is missing, for whom.>

## Acceptance criteria
<!-- Testable behaviours, not goals. Evidence is filled in during /build. -->
- [ ] <behaviour> — evidence: 
- [ ] <behaviour> — evidence: 

## Out of scope
- <explicitly not doing>

## Contract changes (if any)
<!-- e.g. endpoint, table or column, schema or grain, schedule, model input/output, CLI flag, public type -->
| Surface | Change | Notes |
|---------|--------|-------|

## Approach
<Specific: which file gets what. Not "update the service".>

## Files
- `path/file` — <change>

## Slices (T3 only)
| ID | Scope (files) | Depends on | Owner |
|----|---------------|-----------|-------|
| S1 | | – (parallel) | @developer |

## Test triage
| Symbol/File | Class | Test? | Why |
|-------------|-------|-------|-----|

## Test scope
Run: <test files>
Do not run: full suite (that is the @committer gate)

## Security notes
<sensitive surfaces touched, or "none">

## Decisions taken
<!-- Level B decisions made autonomously, one line each with reason -->

## Needs from user
<!-- Level C only: decisions, credentials, access, paid resources, each with the safe way to provide it. Empty = proceed. -->

## Log
<!-- date — agent — what happened (review rounds, deviations, commit hashes, PR url) -->
