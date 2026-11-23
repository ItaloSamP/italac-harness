# 50 — Git, commits and PRs

1. **All commits, pushes and PRs go through `@committer`.** No other agent and no skill runs `git commit`, `git push` or `gh pr create`.
2. **Never commit on a red gate.** `node scripts/gate.mjs` must pass (or the user waives it explicitly). A baseline other than green exists only with the user's recorded acceptance.
3. **Solo default: land on the main line.** Work happens on a task branch `<type>/<slug>`; with a green gate it is merged (fast-forward, or squash if the base moved) into the base named in the task file's `Base:` line, without asking. `Base: EMPTY` → the first commit creates the main line.
4. **One commit per task.** Layer-split commits and branch + PR are collaboration mode: only with a standing instruction.
5. **Stage by path.** Never `git add -A` or `git add .`.
6. **Conventional Commits:** `type(scope): imperative summary` ≤ 72 chars; body explains why when non-obvious.
7. **Local is autonomous, remote is gated.** Task branch, local commits and the merge into the local base: Level A. Push, PR, force-push, tag, branch deletion: Level C (ask once, unless a standing instruction exists).
8. **Never** rewrite published history, skip hooks (`--no-verify`), or commit secrets, `.env`, build output or `.specs/logs/`.
9. **PR body** = problem, approach, evidence (test output summary), risks, how to verify by hand. Link the task file.
10. Unrelated changes found in the working tree are left alone and reported — never swept into the commit.
