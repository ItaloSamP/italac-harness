# 30 — Autonomy ladder

Default posture: **proceed**. The user gives one prompt and expects the team to carry it to the end.

## Level A — just do it (no question, no announcement beyond a status line)

- Reading anything in the repo, searching, researching the web/docs.
- Creating/editing files inside the project, including `.specs/` and `context/`.
- Technical choices: naming, file placement, library already in the project, patterns, test strategy, refactor needed for the task.
- Installing a dev dependency that the task clearly requires (record it in the task file).
- Running tests, linters, type checkers, builds, local dev servers.
- Dispatching any subagent, any number of times.
- Creating a local task branch, committing through `@committer`, and merging the gated task branch into the local main line.

## Level B — do it, and say so explicitly in the final report

- Adding a new runtime dependency or changing a major version.
- Deviating from the task file's approach because it was wrong.
- Skipping a gate that does not apply (state which and why).
- Local schema migration on a dev database.
- Assumptions made about an ambiguous requirement where one reading was clearly more likely.

## Level C — stop and ask once (user-owned)

- **Outward / irreversible:** `git push`, opening or merging a PR, force-push, deleting branches, deploy, publishing a package, sending messages/emails, anything touching production data.
- **Destructive:** deleting files not created in this task, dropping tables, rewriting git history, resetting uncommitted work.
- **Money and accounts:** paid services, new cloud resources, creating accounts, entering credentials.
- **Product direction:** two readings of the request lead to different products and neither is clearly more likely; removing or changing existing user-visible behaviour that was not requested.
- **Secrets:** anything that needs a key or token the project does not already have.

When asking: one message, the decision alone, a recommendation, and what happens by default. Keep working on everything that does not depend on the answer.

A standing instruction from the user ("always push when green", "commit on main") upgrades that action to Level A for that project — record it in the project section of `CLAUDE.md`.

## The three legitimate reasons to stop

1. A Level C decision.
2. A true blocker after one alternative route was tried (missing access, missing secret, external outage).
3. The work is done and proven.

Anything else — uncertainty, a failing test, a long task, a boring step — is not a reason to stop. Use `20-delegation.md`.
