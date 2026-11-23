# Eval: this harness against an ideal general-purpose harness (tech-lead view)

Date: 2026-11-11 · Author: `@tech-lead` · Scope: read-only evaluation, fresh opinion (prior reviews in `.specs/docs/` not read).

## How this was produced

| Inspected | How |
|-----------|-----|
| `CLAUDE.md`, `AGENTS.md`, 12 rules, 14 agents, 13 harness-owned skills, `templates/task.md`, `state.md`, `roadmap.md`, both settings files, 3 scripts, the session hook | Read in full |
| `install.sh`, `test-runner`, `test-generator`, `context-generator`, `security-checker`, `ui-gate.md`, `evals/` | Targeted grep only |
| `node scripts/validate-harness.mjs` | Run: `14 agents · 37 skills · 12 rules · always-loaded descriptions ≈ 5580 tokens`, PASS 0/0 |
| `node scripts/validate-task.mjs` on a bugfix short-form task file | Run: FAIL, 6 errors (weakness 2) |
| `git log` / `git rev-parse` in this repo | Run: branch `master`, zero commits |
| Byte sizes | `CLAUDE.md` + 12 rules = 38.3 KB; `.claude/skills` = 1.4 MB in 103 files |

Not verified: no pipeline was executed end to end against a real project. Every "failure it will cause" below is derived from the text and from documented git and Claude Code behaviour, not from an observed run. `install.ps1` and the vendored skills beyond the greps above were not read.

---

## 1. What an ideal harness must guarantee

An ideal harness guarantees that for any kind of software, one prompt ends in a result that something other than the agent has proven, or in an honest statement of what was not proven. That needs five properties. **Stack neutrality**: planning, building, verifying and delivering are defined in terms the project fills in (its oracles, its commands, its release act), so a dbt model, a Swift screen and an npm library all have a concrete definition of "proven". **Mechanical gates**: anything that must never happen (an unapproved outward action, a commit of unreviewed work, two writers in one file) is stopped by a hook, a permission or a script, and prose is used only for judgment. **Recoverable state**: at any tool call the work can be interrupted, compacted or killed and a cold session resumes from files and git, with a checkpoint to roll back to. **Bounded cost**: the fixed context paid per session and per subagent is measured, and grows only when a logged incident justifies it. **Executable as written**: every instruction names commands, paths and sections that exist, and no two files give different answers to the same question.

Measured against that, this harness is strong on handoff contracts, the autonomy ladder and the test-triage policy. It is weak on stack neutrality (it is a web/JS harness with general wording), on mechanical gates (one hook, which only prints), and on git as the recovery substrate (nothing is committed until the very end).

---

## 2. Coverage by work domain

COVERED = a concrete, executable path exists. PARTIAL = generic wording applies but the domain-specific step or oracle is absent. MISSING = nothing addresses it.

| Domain | Planning | Building | Verification (external oracle) | Delivery |
|--------|----------|----------|-------------------------------|----------|
| **Web app** | COVERED — `discovery`, `blueprint`, `kickoff`; `templates/task.md:26-32` (API and data tables fit exactly) | COVERED — `build/SKILL.md`, `developer.md`, `design/SKILL.md` | COVERED — tests, HTTP call, browser via `/playwright-skill`, `ui-gate.md`, `/web-accessibility` (`40-quality-gates.md:33-37`, `qa-engineer.md:28-30`) | COVERED — `deliver`, `committer.md`, `devops.md:23` (Vercel, Cloudflare, Netlify, Render), ask-list in `settings.harness.json:17-38` |
| **Mobile app** | PARTIAL — generic pipeline; `design/SKILL.md:17` classifies "mobile app" as App UI; no platform decisions (native vs cross-platform, store constraints) prompted | PARTIAL — `developer.md` is stack-agnostic; `design/SKILL.md:50` specifies browser widths, not devices | MISSING — the UI gate is defined as "in a real browser" (`40-quality-gates.md:37`, `ui-gate.md:3`); no simulator/emulator, XCTest, Espresso, Maestro or Detox path; `qa-engineer.md:28-30` lists API/CLI/Web UI only. A native screen can only ever be "not verified" | MISSING — no signing, TestFlight/Play track, `fastlane` or `eas`; none of these are in the ask-list, so a store submission is not permission-gated |
| **Dashboard / BI** | PARTIAL — `design/SKILL.md:17` covers the screen; no metric definitions, grain or source-of-truth step | PARTIAL — as a web UI: covered; in a BI tool (Looker, Power BI, Metabase): nothing | PARTIAL — the UI gate proves that it renders; nothing proves the numbers are right (no reconciliation against a source query) | PARTIAL — web deploy covered; publishing to a BI workspace is not |
| **Data engineering** | PARTIAL — `task.md:30-32` has a table/entity row; no contract for schema, grain, idempotency, backfill, SLA or lineage | PARTIAL — `developer.md` generic; `20-delegation.md:78` names "migration sequences" as hot files; no orchestration (Airflow/Dagster), no dev-versus-prod target rule | MISSING — `40-quality-gates.md:41` lists no data oracle (dbt tests, Great Expectations, row-count and reconciliation checks, schema diff, sample-run on a dev target). `70-testing.md:6` names "data transformations" as test-worthy but not how | MISSING — a pipeline run or backfill against production is "touching production data" (`30-autonomy.md` Level C), yet `dbt`, `bq`, `psql`, `airflow`, `spark-submit` are absent from the ask-list; nothing mechanical stands between an agent and a prod warehouse |
| **Data science / ML** | MISSING — `ai-engineer.md:3` is scoped to LLM features only; no hypothesis, metric, baseline or data-split planning | PARTIAL — code can be written; no handling for notebooks, long-running training (the Bash tool has a 10-minute foreground ceiling; no background-run guidance), seeds, data or model versioning | MISSING — no oracle for a model or an analysis: holdout metric against a baseline, leakage check, reproducibility re-run, statistical validity. The LLM-eval method in `ai-engineer.md:25-28` is the closest and does not transfer as written | MISSING — no model registry, artifact or report as a deliverable; `50-git.md:6` layer-split commits do not fit notebooks or artifacts |
| **CLI / library** | COVERED — `blueprint`; public contracts are a `YES` in `70-testing.md:6` | COVERED — `build`, `developer.md` | PARTIAL — tests and a real CLI run are named (`40-quality-gates.md:33`, `qa-engineer.md:28`); missing: public-API compatibility (semver diff), multi-version/OS matrix, install-from-package smoke test | PARTIAL — `npm/pnpm/yarn publish` are gated (`settings.harness.json:27-29`); `twine upload`, `cargo publish`, `gem push`, `dotnet nuget push`, `mvn deploy` are not; no versioning or changelog step |
| **Infra** | PARTIAL — `tech-lead.md`, `/security-threat-model` (`60-security.md:15`); no state, blast-radius or environment-promotion planning | PARTIAL — `devops.md` (Docker, CI, platform deploy) | PARTIAL — `devops.md:24` "build, lint the config, dry-run"; a plan output (`terraform plan`, `kubectl diff`) is not named as the oracle and no policy check exists | PARTIAL — `terraform apply/destroy`, `kubectl apply/delete`, `docker push` are gated (`settings.harness.json:34-38`); `aws`, `gcloud`, `az`, `helm`, `pulumi`, `fly`, `ansible-playbook` are not |

Reading of the table: one row is fully covered. The delivery and verification columns are where the web assumption is hard-coded, and those are the two columns that decide whether "done and proven" means anything.

---

## 3. The ten most serious technical weaknesses

Ordered by severity, then by how often the failure will occur.

### 1. BLOCKER — the review gate has no defined diff to review

`.claude/agents/code-reviewer.md:23` · `.claude/skills/audit/SKILL.md:8,23` · `.claude/agents/committer.md:29`

**Problem.** The reviewer is told to get the change with `git diff <base>...HEAD`, base defaulting to `main`. `/audit` runs before `/deliver`, and the branch and the first commit are created by `@committer` in `/deliver`. At review time the whole change is uncommitted in the working tree. A three-dot diff compares the merge base with the `HEAD` commit and does not include the working tree, so the command returns nothing, or returns unrelated older commits. The base is also hard-coded: this repository is on `master` with zero commits, where the command exits with `fatal: ambiguous argument 'HEAD'`.

**Failure in real use.** The one gate that the pipeline treats as independent proof receives an empty or wrong input. A capable reviewer will improvise with `git status`, which makes the reviewed scope non-deterministic; a weaker run returns `APPROVED (0B/0M)` on an empty diff. With several task files in flight (`kickoff/SKILL.md:39-40`), uncommitted changes from different tasks are indistinguishable.

**Fix.** Create the feature branch at the start of `/build`, not in `/deliver`. `/audit` writes the exact change to a file and passes its path in the brief: `git diff <merge-base>` (working tree) plus `git ls-files --others --exclude-standard`, restricted to the task file's `## Files`. Resolve the base from `git symbolic-ref refs/remotes/origin/HEAD`, falling back to the branch the task started on. Handle the zero-commit repository explicitly.

### 2. BLOCKER — every `/bugfix` dead-ends at `/deliver`

`.claude/skills/bugfix/SKILL.md:31` · `.claude/agents/committer.md:25` · `scripts/validate-task.mjs:25,47,50`

**Problem.** `/bugfix` prescribes a short-form task file (Problem and acceptance criteria only). `@committer` Mode A requires `validate-task.mjs` to pass, and the script demands `Out of scope`, `Approach`, `Files`, `Test scope` and a `Proof` line in `Amplified brief`. Run on a short-form file: `FAIL (6 errors)`, exit 1.

**Failure in real use.** The committer returns `BLOCKED`. The Maestro then pads the file with invented sections to satisfy a regex, or falls back to Mode B, which carries no status precondition and so skips the acceptance-evidence check. Hotfix task files (`hotfix/SKILL.md:14`) also break the `task-<slug>.md` naming in `75-context-docs.md:43`.

**Fix.** Add `--profile fix|hotfix` to `validate-task.mjs` with a reduced required-section list, and have `bugfix/SKILL.md:31` and the committer name the profile. One file-name convention for all three.

### 3. MAJOR — task-file ownership contradicts itself, and the result is two writers on one file

`.claude/rules/10-orchestration.md:47` · `.claude/rules/20-delegation.md:74,76` versus `.claude/skills/blueprint/SKILL.md:39` · `.claude/templates/task.md:40-43` · `.claude/skills/build/SKILL.md:17-19` · `.claude/agents/developer.md:33` · `scripts/validate-task.mjs:53`

**Problem.** Two rules say one task file per slice. The blueprint, the template, the build skill and the validator all implement slices as rows of a table inside one task file. Each parallel `@developer` is then told to "update the task file: tick ACs with evidence, set `Status: IN_REVIEW`".

**Failure in real use.** Up to four agents edit the same file concurrently, which is the exact case `20-delegation.md:76` forbids. Edits fail on stale content or overwrite each other; the first developer to finish sets the whole task to `IN_REVIEW` while three slices are still being written.

**Fix.** One task file, one writer: in fan-out mode developers return AC evidence in the handoff and the Maestro writes it. Change `developer.md:33` and delete "one per slice" from `10-orchestration.md:47` and "its own task file" from `20-delegation.md:74`.

### 4. MAJOR — the commit gate cannot pass in a repository with a known-red or absent suite

`.claude/agents/committer.md:12` · `.claude/rules/50-git.md:4` versus `.claude/rules/70-testing.md:13`

**Problem.** The committer rule is "full test suite and typecheck/lint; red → no commit", with zero exceptions other than a hotfix waiver. Rule 70 acknowledges pre-existing failures and says not to investigate them. Nothing tells the committer to subtract them. The gate is also undefined where no suite or typechecker exists (a notebook repository, a SQL project, a fresh scaffold).

**Failure in real use.** In any brownfield project with one failing test, no task can ever be committed; the Maestro has to ask the user for a waiver on every delivery, which is the interruption the autonomy ladder exists to prevent. The gate also runs on `sonnet` inside one Bash call; a suite longer than ten minutes times out.

**Fix.** Define the gate as "no new failures against a recorded baseline". Add `scripts/gate.mjs` that reads the gate commands from a machine-readable block in the project section of `CLAUDE.md`, runs them, compares with the baseline in `context/TESTING-POLICY.md`, and exits non-zero only on new failures. An empty command block is an explicit `NO GATE DEFINED` result that is reported, not a pass.

### 5. MAJOR — verification is defined for the web and nowhere else

`.claude/rules/40-quality-gates.md:33,37,41` · `.claude/agents/qa-engineer.md:28-30` · `.claude/skills/design/SKILL.md:17,50,64` · `.claude/skills/design/references/ui-gate.md:3` · `.claude/templates/task.md:26-32` · `.claude/rules/60-security.md:8,12` · `.claude/rules/75-context-docs.md:10-11`

**Problem.** The verification ladder is "test → CLI/HTTP/browser → reading". The UI gate requires a browser at five pixel widths. The task template has a REST table and a table/entity table. Security rules speak of routes and clients. The context docs are `API.md` and `DATA_MODEL.md`. `devops.md:23` and the ask-list name four web hosts.

**Failure in real use.** On a native mobile screen the Definition of Done line "UI gate passed" (`40-quality-gates.md:12`) cannot be satisfied, so the task either never reaches `READY_TO_COMMIT` or the gate is silently treated as not applicable. On a data pipeline or a model, the task file names "the tests" as the oracle, the tests assert on a three-row fixture, and a wrong join or a leaking feature ships as proven. This is the central gap against the stated goal.

**Fix.** Make the oracle a project-declared fact instead of a harness assumption. Add `context/VERIFICATION.md` (written by `/context-generator` and by kickoff phase 6) that states, per surface in this project, the command that proves it. Ship one on-demand reference, `.claude/skills/build/references/oracles.md`, with the menu per domain (simulator and UI-test run; dbt test, row-count reconciliation and schema diff on a dev target; holdout metric against a baseline plus a reproducibility re-run; API-compatibility diff and install smoke test; plan output). Reword `40-quality-gates.md:33,37` to "the surface's declared oracle". Replace the two tables in `task.md` with one "Contract changes" section.

### 6. MAJOR — Level C is enforced by a JS/web allow-list and by prose

`.claude/templates/settings.harness.json:14,17-38,44-50` · `.claude/rules/30-autonomy.md` (Level C) · `.claude/rules/50-git.md:3` · `scripts/validate-harness.mjs:137-140`

**Problem.** `Bash` is allowed wholesale. The ask-list is a fixed set of prefixes from the JS and web ecosystem. `git commit` is unrestricted, so "only `@committer` commits" is a sentence. `Read(./.env)` is denied but `Bash(cat .env)` is not. The only hook is `SessionStart`, which prints. The active `.claude/settings.json:17` writes patterns as `Bash(git push:*)` while the template writes `Bash(git push *)`; the validator only checks that both parse as JSON. Which form the installed Claude Code version honours was not verified.

**Failure in real use.** `twine upload`, `cargo publish`, `fastlane`, `eas submit`, `gcloud`, `aws`, `helm upgrade`, `dbt run --target prod`, `bq query`, a `psql` session against a production URL: each is an outward or production-data action, and each runs without a prompt. A prefix match is also evaded by ordinary command shapes such as `cd x && git push` or `git -C x push`. The domains the goal adds (data, mobile, infra) are the ones with no mechanical guard.

**Fix.** Add a `PreToolUse` hook on `Bash` (`.claude/hooks/guard.mjs`) that tokenises the command and matches categories (publish, deploy, cloud-mutating, database-mutating, history-rewriting, secret-reading), with a project-extensible list in `context/ENVIRONMENT.md`. Have the validator diff the two settings files. Rule 85 puts hooks and permissions in the "Ask first" tier, so this is a proposal for the user, not a self-applied fix.

### 7. MAJOR — parallel slices share one working tree and nothing is checkpointed until the end

`.claude/rules/20-delegation.md:74-80` · `.claude/rules/50-git.md:4` · `.claude/agents/committer.md:12` · `.claude/rules/40-quality-gates.md:29` · `.claude/skills/audit/SKILL.md:34`

**Problem.** Up to four developers edit the same checkout at once, and each is told to typecheck and run scoped tests as it goes. The first commit happens after build and audit have both finished. The fix loop asks the reviewer to "re-check the fix diff only", but with no commit between rounds there is no fix diff to compute.

**Failure in real use.** In any stack where a unit test needs the package to compile (TypeScript project builds, Go, Rust, Kotlin, Swift), slice A's tests fail on slice B's half-written file; A spends its two strikes on a failure it did not cause and returns `NEEDS: @debugger`. A whole T3 change lives uncommitted across many agent runs, with no rollback point if one of them damages the tree. Re-reviews are full re-reviews, three times over, at full context cost.

**Fix.** A git worktree per slice for fan-out (the runtime supports worktree isolation for subagents), merged by the Maestro at integration. Checkpoint commits on the feature branch after each green slice and after each fix round, made by `@committer` with a `wip:` type and squashed or kept at delivery. The fix diff then becomes a commit range. `50-git.md:4` changes from "never commit on a red gate" to "never deliver on a red gate".

### 8. MAJOR — the fixed context cost is larger than the validator reports, and every subagent pays it

`.claude/rules/00-core.md:38` · `scripts/validate-harness.mjs:34,49,66,152` · `.claude/rules/85-self-improvement.md` (guardrail "Watch the budget") · `.claude/skills/retro/SKILL.md:53`

**Problem.** The validator's budget sums description lengths only: about 5.6k tokens. `CLAUDE.md` plus the twelve rule files are another 38.3 KB, roughly 9.6k tokens, and are not counted. Per `00-core.md:38` the rules load in every subagent. Four of them (`10`, `80`, `85`, `90`; 12.0 KB, about 3k tokens) address only the Maestro. Vendored skills add large on-demand loads: `create-technical-design-doc` 52 KB, `the-judge` 20 KB, `mermaid-studio` 19 KB, `the-jury` 18 KB.

**Failure in real use.** Each dispatch starts roughly 15k tokens deep before its brief. A T3 audit is four reviewers, re-dispatched for up to three rounds. The retro's bloat check (`retro/SKILL.md:53`) reads a number that does not move when a rule grows, and rules are exactly what a retro edits, so the fixed cost can only rise unobserved.

**Fix.** Make the validator count `CLAUDE.md` and rule bytes, print both figures, and warn above a threshold. Move the Maestro-only material out of auto-loaded rules: rule 85 into `/retro` behind a three-line stub, rule 80's output shape into `/amplify`. Rule 85's own tiering makes the change to rule 80 a user decision.

### 9. MAJOR — resumability stops at phase boundaries

`.claude/skills/kickoff/SKILL.md:10` · `.claude/rules/75-context-docs.md:50` · `.claude/rules/10-orchestration.md:60` · `scripts/validate-task.mjs:19` · `.claude/hooks/session-start.mjs:25-27` · `.claude/templates/task.md:62-63`

**Problem.** `STATE.md` is updated at phase and milestone changes. Inside a build, the only durable signal is `Status: IN_PROGRESS`; the task `Log` is specified for review rounds and commits, not for progress. `BLOCKED: <reason>` replaces the status, and the rule says to "restore the previous status" that is no longer written anywhere. The state machine has no terminal state other than `SHIPPED`: no cancelled, superseded or abandoned. The hook treats `COMMITTED` as closed although it is unpushed, and shows at most eight open tasks.

**Failure in real use.** After a compaction or a new session in the middle of a T3 build, the Maestro knows the task is in progress and nothing else: which slices returned, which integration changes were applied, which review round it is in. It re-dispatches finished slices or skips unfinished ones. Abandoned tasks appear as open in every session forever and crowd real ones out of the eight-item list.

**Fix.** `/build` and `/audit` append one `Log` line per completed step, slice and round; with weakness 7 fixed, each line carries a checkpoint commit hash. Write `BLOCKED(<previous>): <reason>`. Add `CANCELLED` and `SUPERSEDED: <task>` to `validate-task.mjs:19` and to the hook's closed set. Show `COMMITTED` tasks as "awaiting push".

### 10. MAJOR — instructions that cannot be executed as written, outside the validator's reach

`.claude/skills/test-runner/SKILL.md:8,10,15,35` · `.claude/agents/explorer.md:4,14,50` · `.claude/skills/retro/SKILL.md:45` · `.claude/rules/85-self-improvement.md` (loop step 4) · `scripts/validate-harness.mjs:90` · `install.sh:24-30`

**Problem.**
- `/test-runner`, called from `build/SKILL.md:36` on every build, reads a task-file section named `## Escopo de teste`. The template's section is `## Test scope`. It takes commands from "CLAUDE.md §2", which does not exist, refers to "`@committer` Step 2.4", which does not exist, and falls back to "ask the user", against `30-autonomy.md`. The validator cross-checks only the fourteen `OWN_SKILLS`, so vendored skills that the pipeline depends on are unchecked.
- `explorer.md:50` allows "a full map file under `.specs/docs/`"; the agent has no `Write` tool and line 14 forbids writes.
- The self-improvement loop requires re-running `evals/agents/<name>.md` after an agent change. One eval file exists (`explorer.md`) for fourteen agents, and `install.sh` does not copy `evals/`, so in an installed project the step cannot run for any agent.

**Failure in real use.** Scoped testing silently degrades to "tests matching the git diff", which with an unborn `HEAD` or a clean index finds nothing. Agent fixes made by `/retro` are recorded as proven without a scenario to prove them.

**Fix.** Correct the three references in `test-runner`. Extend the validator to every skill that an owned file invokes, and to check that each `## <Section>` a skill reads exists in `templates/task.md`. Drop the map-file clause from `explorer.md:50` or grant `Write` scoped to `.specs/docs/`. Either write the thirteen missing eval files or reword the loop to "where an eval exists", and report the absence.

---

## 4. What to cut

| Cut | Where | Why it costs more than it returns |
|-----|-------|-----------------------------------|
| Layer-split commits | `50-git.md:6`, `committer.md:15-16` | Splitting one vertical slice into structure → logic → UI → tests produces commits where logic lands without its tests, contradicts the vertical-slice roadmap (`kickoff/SKILL.md:32`) and the "each commit leaves the tree coherent" rule, and needs a model to classify every file. One commit per task or slice is cheaper and bisects better. |
| Mandatory `/retro` at every milestone | `kickoff/SKILL.md:42` | Rule 85's own guardrail is "no rule is added for a hypothetical". A scheduled retro with no open incident produces text. Run it only when `incident.mjs open` is non-empty. |
| Duplicate protocol in `AGENTS.md` | `AGENTS.md:31-90` | Handoff block, help table, pipelines and state machine restate `20-delegation.md` and `10-orchestration.md`, against the project's own "policies live in rules only" convention. Keep the roster and a pointer. |
| The amplified-brief block in every task file | `templates/task.md:9-13` | Three of four lines are narration with no later consumer. Only `Proof` is read (by `validate-task.mjs:46`). Keep a single `## Proof` section. |
| Overlapping decision and review engines | `the-jury` (18 KB), `the-judge` (20 KB), next to `/audit` and `/the-fool` | Four mechanisms for "get a second opinion". Each adds a description to every session's routing budget. Keep `/audit` and `/the-fool`; make the others optional installs. |
| Web-only skills in the core | `web-accessibility`, `frontend-design`, `playwright-skill`, `mermaid-studio` (55 KB together) | They are right for one row of the coverage table. Move them to a web pack under `optional/`, next to the design engines, so the core is neutral and other domains get equivalent packs. |
| Fixed model pins by role | `AGENTS.md:16-29`, agent frontmatter | `@committer` on a smaller model runs the full gate and classifies every changed file, which is the highest-consequence step. Pin only `@explorer`; let the rest inherit. |

---

## 5. The three changes with the highest leverage, in order

1. **Make git the substrate of the pipeline, from the first edit.** Branch at `/build` start, a worktree per parallel slice, checkpoint commits after each green slice and each fix round, review on an explicit diff written to a file. This removes weakness 1, weakness 7 and most of weakness 9 with one mechanism, and it is what makes the review gate and the fix loop mean what they say. Proof: a scripted dry run in a scratch repository with zero commits and with a `master` default branch, asserting that the reviewer brief contains a non-empty diff restricted to the task's files.

2. **Replace the web assumptions with a project-declared verification profile.** `context/VERIFICATION.md` plus one on-demand oracle reference and `scripts/gate.mjs` reading machine-readable gate commands and a failure baseline. This removes weaknesses 4 and 5 and turns five of the seven coverage rows from MISSING/PARTIAL to COVERED in the verification column, without adding domain agents. Proof: the gate script run against three fixture projects (Python with one known-red test, a dbt project, a repository with no suite) returning pass, pass and `NO GATE DEFINED`.

3. **Move enforcement from prose to mechanism, and widen the validator to what the pipeline really calls.** A `PreToolUse` guard hook for outward and production actions by category; task-file profiles in `validate-task.mjs`; validator checks for rule and `CLAUDE.md` bytes, settings drift, section names that skills read, and vendored skills on the pipeline path. This removes weaknesses 2, 6, 8 and 10. The hook and permission parts need the user's approval under rule 85. Proof: `validate-harness.mjs` fails on the current tree for the `test-runner` references before the fix and passes after; a table-driven test of the guard hook over a list of commands per category.

Not chosen for the top three: adding specialist agents per domain (data engineer, mobile engineer, ML engineer). The gap is in what counts as proof and what is gated, not in who writes the code; new agents would add routing cost and leave both gaps open.

---

## Round 2 — response to product-manager

Source: `.specs/docs/eval-ideal-harness-pm.md`. Basis: reading only; no pipeline was run in this round either. The two reports agree on the diagnosis (web-only proof, a commit gate that cannot pass in brownfield, too much ceremony). They differ on git and on how much to cut.

### 1. Their ten gaps

| # | Their gap | Position | Technical reasoning | Fix cost |
|---|-----------|----------|---------------------|----------|
| 1 | Work never lands on the main line | AGREE | Confirmed by trace (section 2 below). It compounds my weakness 1: the review diff is wrong for two independent reasons. | Cheap in text; the local merge loosens `50-git.md:9`, so it needs the user |
| 2 | Data engineering and data science absent | AGREE-BUT | Agree on requirement slots, proof and "delivered". Disagree that it needs new owners: a profile that changes the oracle and the task-file slots is enough; the analysis route is the one real addition. | Medium |
| 3 | Mobile claimed, only a browser exists | AGREE | Same as my weakness 5. One addition: this user's host is Windows, where an iOS simulator cannot run at all, so iOS verification is not buildable locally whatever the harness says. | README statement cheap; real support expensive |
| 4 | Only two speeds | AGREE-BUT | A middle mode is right. The dial must choose the review panel only; the risk test has to be the existing sensitive-surface list (`10-orchestration.md:58`), not the user's word. Promote-in-place is safe only if the prototype then passes the same gate as built work. | Cheap in text; makes the harness more permissive |
| 5 | No adoption path for a red or absent suite | AGREE | Identical to my weakness 4. Their adoption pass is the missing step that creates the baseline my `gate.mjs` reads. | Medium |
| 6 | First run tells the user to start an interview | AGREE | `session-start.mjs:16` and the installer message are ours to change; the vendored skill is not, so the fix is in the caller. | Cheap |
| 7 | Prerequisites arrive one by one; no real-data policy | AGREE | The policy is text. Its enforcement is my weakness 6: `Read(./.env)` is denied but any shell command can read it or open a production connection. | Policy cheap; enforcement is the guard hook |
| 8 | Reports speak engineer | AGREE-BUT | Add the "how to see it" line and where the work lives. Keep the evidence block: it is what the Maestro and the next session check. `00-core.md:46` already requires the user's language, so this is a template fix. Collapsing the amplifier edits rule 80. | Cheap |
| 9 | No notion of the user's budget | AGREE-BUT | An agent cannot read its own token usage, so a cost figure would be invented. A plan preview in counts (phases, task files, dispatches) and a cap on dispatches per task are buildable. | Preview cheap; real estimates TBD |
| 10 | Learns the process, not the person | AGREE-BUT | The user-level home already exists in the runtime: `~/.claude/CLAUDE.md` and the per-project auto-memory, which on this machine already holds the autonomy and amplifier preferences. Point at it; do not build a second profile. One-step upstreaming is a real gap. | Cheap (pointer); upstreaming medium |

### 2. Their two direct asks

**Ask 1 — what base is the second task's branch cut from, and what does `@code-reviewer` diff against? Their gap 1 is confirmed.**

- No file names a base for the branch. `committer.md:14` says "`<type>/<slug>` from the task file"; `committer.md:29` says "Create/switch branch". Nothing ever checks out the main line again after a task.
- So the base is whatever `HEAD` is. After task 1 that is `feat/<task-1>`. Task 2's branch is therefore cut from task 1's branch by accident: an unintended stack.
- The main line never advances. Merge is Level C (`50-git.md:9`), `git merge` is in the ask-list (`settings.harness.json:18`), and `/deliver` asks only about push and PR (`deliver/SKILL.md:27-37`). `SHIPPED` is set on a PR URL (`committer.md:31`).
- `@code-reviewer` diffs `git diff <base>...HEAD` with base `main` (`code-reviewer.md:23`; `audit/SKILL.md:8,23`). For task 2 that range contains all of task 1's commits and none of task 2's work, which is still uncommitted. The reviewer is shown the previous task.
- `committer.md:29` then lists `git log --oneline <base>..HEAD`, which also includes task 1; a PR for task 2 carries both.
- One correction to their text: the milestone tree is not undefined. If nobody switches branches, the last branch holds every task. That is an accident of `HEAD`, not a design, and it breaks the first time anything checks out `main`.

**Ask 2 — which roster merges are safe.** An agent that is never dispatched costs only its description, so the saving is in hops, not in the roster count.

| Agent | Verdict | Reason |
|-------|---------|--------|
| `@tech-writer` | Safe to fold into the Maestro | Its method is a list of skills the Maestro can call (`tech-writer.md:25-30`); no isolation benefit. |
| `@product-manager` | Safe to fold into `/discovery` | It cannot interview and runs an interview-shaped skill (`product-manager.md:3,28`); the Maestro already holds the answers. |
| `@ai-engineer` | Safe to turn into a skill used by `@developer` | Same tools and write scope as the developer; what it adds is method. |
| `@explorer` | Keep | Its value is reading a lot outside the caller's context on the cheapest model. |
| `@researcher` | Keep, separate from `@explorer` | It is the only role that reads the open web and it has no edit tool. Merging it into a writing role puts untrusted text next to write access. |
| `@debugger` | Keep | Fresh context after two failed attempts is the mechanism. |
| `@code-reviewer`, `@security-auditor`, `@qa-engineer` | Never merge with an author | For non-sensitive T2 work the reviewer alone is enough, which the audit panel table already allows. |
| `@committer` | Not safe to remove today | It is the only boundary around commit and push, and that boundary is prose. It becomes removable once the gate script and the guard hook exist. |
| `@designer`, `@devops` | Keep | Different toolsets and gates. |

Net: 14 to 11 is safe now. Deleting an agent is "Ask first" under rule 85.

### 3. Where the proposals conflict, and the one design for each

**Git: their "work lands on main locally, no branch, no question" against my "branch at build start, worktree per slice, checkpoint commits".**
Both hold with a short-lived task branch that the user never has to see:

1. `/build` cuts `<type>/<slug>` from the main line, always, by name. Fan-out adds a worktree per slice; single-slice work does not.
2. Checkpoint commits go on that branch after each green slice and each fix round.
3. The reviewer gets `main..<branch>` written to a file. The base is defined, and the fix diff is a commit range.
4. On a green gate `@committer` squash-merges into the local main line: one commit per task, which is also their "one coherent commit" ask. Push and PR stay gated and are asked only when a remote exists.
5. The report states where the work is and how to see it.

Step 4 moves local merge from Level C to Level A. That loosens `50-git.md:9`, so it is the user's decision; recommended as the default for a solo project, recorded as a standing instruction.

**Rigor dial against mechanical gates.** The dial selects how many reviewers run. It never switches off the gate script, the task validator or the guard hook, and a sensitive surface forces the full panel whatever the dial says.

**Their "project-type profiles" against my `context/VERIFICATION.md`.** Same object. Use their broader definition (requirement slots, proof, "delivered", what is needed from the user, data handling) and my constraint that it is a project-declared file read on demand, not a new always-loaded rule and not new agents.

**Their "start with one context file" against my adding a file.** The profile starts as a block in the project section of `CLAUDE.md` and splits out only when it outgrows it.

### 4. "Over-built" items I would refuse to cut

| Their cut | Position | Why |
|-----------|----------|-----|
| Branch per task | Refuse | The branch is what gives the reviewer a base and the task a rollback point. Cut the PR and the question, not the branch. |
| ADR entries in `context/DECISIONS.md` | Refuse | One line per decision is what stops a later session from re-deciding the stack. Agree to drop the separate ADR file for small decisions and to make `/the-jury` optional. |
| Threat model on new integrations | Refuse as worded, narrow it | Keep the trigger for a new trust boundary: credentials held, personal data, public exposure. Their own pipeline example holds an API key and warehouse credentials, so it still qualifies. Drop it for a keyless public API. |
| `@explorer`, `@researcher`, `@committer` as separate roles | Refuse | Section 2 above. |
| Ten context files down to one | Partly refuse | `GOTCHAS`, `DECISIONS` and the commands block must exist from the first task; the rest can wait until there is content. |
| Full document chain in `/kickoff` | Partly refuse | Lean default is right. `STATE.md` and the roadmap are not documents for the user; they are the resume mechanism and stay. |

Agreed without reservation: layered commits, retro on a schedule, the multi-runtime protocol in `AGENTS.md`, the printed amplifier block, and moving Mermaid, accessibility and Figma skills to optional.

### 5. Merged priority list

Tier per `85-self-improvement.md`. Rule 85 also requires a logged incident behind every change; none of these has one yet, so the first act is to log them.

| # | Change | Covers | Tier |
|---|--------|--------|------|
| 1 | Git model: task branch cut from the main line at `/build`, review on an explicit `main..branch` diff file, checkpoint commits, local squash-merge when green | PM 1; mine 1, 7, part of 9 | Branch and diff: fix-now. Local merge without a question: ask-first |
| 2 | Repair what cannot execute: bugfix and hotfix profiles in `validate-task.mjs`, the three dead references in `test-runner`, one writer for the task file, `explorer.md:50` | mine 2, 3, 10 | fix-now |
| 3 | Baseline gate: an adoption pass that records current test, lint and typecheck state, and `gate.mjs` that fails only on new failures | PM 5; mine 4 | ask-first (relaxes "zero exceptions" in `committer.md:12`) |
| 4 | Reports end with how to see it and where the work lives; first run asks nothing (installer message, `session-start.mjs:16`) | PM 6, 8 | fix-now. Collapsing the amplifier: ask-first |
| 5 | Project profile: requirement slots, declared oracle, "delivered", needs-from-user list, data handling. Data pipeline and analysis first. README states that mobile is not verified | PM 2, 3, 7; mine 5 | fix-now (additive and stricter) |
| 6 | Guard hook on shell commands by category, wider ask-list, real-data rules enforced there | PM 7; mine 6 | ask-first |
| 7 | Rigor dial with a lean default and a plan preview in counts; sensitive surfaces force the full panel | PM 4, 9 | ask-first |
| 8 | Cost: validator counts rule bytes; drop scheduled retro, layered commits and the `AGENTS.md` duplicate; fold three agents; web-only skills to optional | PM section 4; mine 8, section 4 | Validator, retro, duplicate: fix-now. Removing agents or skills: ask-first |

Difference in order from their v1 cut: they put the rigor dial second. I put it seventh because it makes the harness more permissive, and that is only safe after items 1 to 3 make the remaining gates real. Items 2 and 4 are ahead of it because they are cheap and need no decision.
