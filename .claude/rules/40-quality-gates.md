# 40 — Quality gates and Definition of Done

## Definition of Done (T2+)

A task file may move to `READY_TO_COMMIT` only when every line is true:

- [ ] Every acceptance criterion in the task file has **evidence** next to it (test name, command output, screenshot path).
- [ ] Typecheck / lint / build pass with the project's own commands.
- [ ] Scoped tests pass; new behaviour classified `YES` in the test triage has tests.
- [ ] `@code-reviewer` returned no open `BLOCKER` or `MAJOR`.
- [ ] `@security-auditor` passed when a sensitive surface was touched.
- [ ] UI gate passed when an interface is part of the deliverable.
- [ ] Diff contains only what the task needs. No debug output, commented-out code, TODOs without an owner, or unrelated formatting.
- [ ] Context docs updated when structure changed (`75-context-docs.md`).

## Review severities

| Severity | Meaning | Action |
|----------|---------|--------|
| `BLOCKER` | Wrong behaviour, data loss, security hole, broken build | Must fix. Blocks commit. |
| `MAJOR` | Likely bug, missing AC, missing test on risky logic, contract break | Must fix or get explicit user waiver. |
| `MINOR` | Maintainability, naming, small duplication | Fix if cheap; otherwise note in task file. |
| `NIT` | Taste | Ignore unless it changes meaning. |

Every finding: `path:line — severity — problem — concrete fix`. No praise, no finding without a location.

## Fix loop

Reviewer findings → Maestro (or `@developer`) fixes → **same reviewer re-checks the fix diff only**. Maximum 3 rounds; a 4th means the approach is wrong → `@tech-lead`.

## Verification beats inspection

Prefer, in this order: an automated test → running the real thing through the surface's declared oracle (`## Verification` in `CLAUDE.md`; menu per kind: `.claude/skills/build/references/verification.md`) → reading the code. Reading alone is the weakest evidence and must be labelled as such.

## UI gate

When an interface is part of the deliverable, "done" also requires the UI gate from `/design` step 6, run on the real surface (web: a browser; native mobile: the declared simulator or device command): the engine's own gate when a design engine was used, and always the floor checklist `.claude/skills/design/references/ui-gate.md`. A gate that could not run is reported as **not verified**.

## What can prove it besides us

Each task file names at least one **external oracle** for its result: a test suite, a type checker, a linter, a schema validator, a real HTTP response, a browser run, CI, a reference implementation, a reconciliation against a trusted figure, a holdout metric against a baseline, a plan or dry-run output, or the user's own acceptance step. If none exists, creating one is part of the task.

## Harness changes

Any change to `.claude/` or the root instruction files must pass `node scripts/validate-harness.mjs` before commit.
