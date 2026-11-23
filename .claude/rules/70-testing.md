# 70 — Testing policy

The project's own `context/TESTING-POLICY.md` wins when it exists. Otherwise:

1. **Triage before coding.** For each new/changed symbol decide `YES`/`NO` and why:
   - `YES` — business logic with branches, security boundaries, parsing/validation, data transformations, state machines, bug fixes (regression test is mandatory), public contracts.
   - `NO` — presentational UI without logic, glue/wiring, generated code, config, trivial getters, implementation details that a refactor would break.
   Zero tests is a valid outcome when every row is `NO`.
2. **Test behaviour, not implementation.** Assert on outputs and observable effects. Mock only at system boundaries (network, clock, filesystem, third-party APIs).
3. **Scoped by default.** Run only tests for touched files. The full suite runs once, at the `@committer` gate, or when the user asks for regression.
4. **A bug fix starts with a failing test** that reproduces the bug, then the fix makes it pass.
5. **Never make a test pass by weakening it** — no deleting assertions, `skip`, widened matchers or snapshot updates without understanding the diff. A test you believe is wrong goes in the handoff as a concern.
6. **Pre-existing failures** are listed in `context/TESTING-POLICY.md` and encoded in the gate baseline (`## Verification`); do not re-investigate them, do not hide new failures among them.
7. **User-facing flows** on T3 or when UI is the deliverable: `@qa-engineer` verifies on the real surface with its declared oracle (web: `/playwright-skill`) and stores screenshots under `.specs/logs/`.
8. Test commands come from the project section of `CLAUDE.md`. If missing, discover them from manifests and CI config and record them there.
