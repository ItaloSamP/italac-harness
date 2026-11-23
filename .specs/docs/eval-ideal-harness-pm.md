# Product evaluation — the harness against "one person, any kind of software"

Author: `@product-manager` · Date: 2026-11-11 · Status: independent opinion (prior reviews in `.specs/docs/` were not read)

**Standard used.** An ideal harness for a solo developer who vibe codes: short prompts in Brazilian Portuguese, a team that carries the work to a result the user can see and use, questions only for decisions that are truly the user's, and a system that gets better the more it is used. "Any kind of software" means web apps, mobile apps, dashboards, data-engineering pipelines and data-science/ML work.

**Method and limits.** Every finding comes from reading the harness as written: `README.md`, `CLAUDE.md`, `AGENTS.md`, the 12 rules, the 14 agents, the 12 pipeline skills, `templates/task.md`, `optional/README.md`, plus `install.ps1`, `hooks/session-start.mjs`, `templates/settings.harness.json`, `templates/state.md`, `templates/roadmap.md`, `skills/design/references/ui-gate.md`, and parts of `context-generator`, `tlc-prd`, `test-generator`. Nothing was executed. The journeys are walkthroughs of the text, not observed runs; a real model may behave better or worse than the text. Claims I could not confirm from the text are marked PLAUSIBLE. No user research or usage data exists; none is invented here.

**Headline.** The harness is a complete product for one job: adding a feature or fixing a bug in a web codebase that already has git, tests and a browser-testable UI, for a user who thinks like an engineering manager. Against the stated standard it does two of the five journeys partly and three poorly, and one defect (work never lands on the main line) hits every multi-task project regardless of domain.

---

## 1. Jobs to be done, ranked

Ranking is by how often the job occurs for this user and how much of the product's promise rests on it.

| # | Job (when I…, I want…, so I can…) | Done end to end today? | What does it, or the gap |
|---|---|---|---|
| 1 | When I have a change in mind for an existing web app, I want to say it in one line and get it working and proven | **PARTLY** | `/blueprint` → `/build` → `/audit` → `/deliver` is complete and coherent (`.claude/rules/10-orchestration.md:17`). It stops at a commit on a feature branch or an open PR; nothing merges it or tells the user how to see it (gap 1, gap 8). |
| 2 | When something breaks, I want to paste the symptom and get the cause and a fix | **PARTLY** | `/bugfix` is sound (`.claude/skills/bugfix/SKILL.md`). On a typical vibe-coded app with no tests and a red lint, the commit gate blocks and the user is asked to waive (gap 5). |
| 3 | When I have an idea for a new product, I want to go from a sentence to a running first version | **PARTLY (web) / NO (mobile, data)** | `/kickoff` has all phases and a resumable state file. First running product arrives after six phases; merge gap strands milestone work; mobile and data have no verification path (gaps 1, 2, 3, 4). |
| 4 | I want to be asked only what is mine to decide | **PARTLY** | `.claude/rules/30-autonomy.md` is clear and good. Undermined by the context-generator interview on first contact (gap 6), a push/PR question on every task until a standing instruction exists, and late requests for credentials (gap 7). |
| 5 | I want to see and try the result, not read about it | **NO** | Reports are evidence for engineers: commands, paths, task files (`.claude/rules/90-communication.md:4-17`). No report has a "how to open it / try it" line. Visual checkpoints exist only at the prototype phase of `/kickoff`. |
| 6 | When I want to try something quickly, I want speed and then to keep what worked | **PARTLY** | `/prototype` gives speed. It forbids keeping the result: "Promotion means rebuilding properly, not merging the prototype" (`.claude/skills/prototype/SKILL.md:32`). A vibe coder iterates the prototype into the product (gap 4). |
| 7 | I want to build things that are not web apps: mobile, pipelines, analyses, models | **NO** | No tier, agent, template field, oracle or gate for mobile runtime, data engineering or data science (gaps 2, 3). |
| 8 | I want the team to get better over time and to know me | **PARTLY** | Rule 85 + `/retro` + `scripts/incident.mjs` improve the *process* and the loop has been exercised (2 incidents logged and closed in `.specs/harness/incidents.jsonl`). It does not learn the *user* (preferred stack, taste, recurring answers) across projects, and fixes made in a project do not flow back without manual porting (gap 10). |
| 9 | I want to put it online / in the store / on a schedule and keep it running | **PARTLY (web deploy) / NO (rest)** | `@devops` prepares web deploys and gates them at Level C. No mobile build and store path, no scheduling and monitoring of a pipeline, no "operate" phase; `SHIPPED` means "PR URL" (`.claude/skills/deliver/SKILL.md:37`). |
| 10 | I want to stay within my time and token budget | **NO** | No budget concept. Dispatching subagents "any number of times" is Level A (`.claude/rules/30-autonomy.md:12`); the only budget watched is the harness's own always-loaded tokens (`.claude/rules/85-self-improvement.md:45`) (gap 9). |

---

## 2. Five journeys, walked through the text

Legend: **STUCK** the user cannot proceed without knowing something the harness did not tell them · **BAD ASK** asked something that is not theirs · **NO ANSWER** left without a result or a clear state · **UNWANTED** receives something they did not want.

### (a) "quero criar um app mobile de X" — from zero

1. Before the first prompt the user needs a folder with the harness in it. The README says "Abra um projeto com o harness instalado" (`README.md:7`); for a new project that means running `install.ps1 -Target <new folder>` from the harness repo first. **STUCK** (mild): the from-zero path is never described as such.
2. Installer ends with "Next: open the project in Claude Code and run /context-generator --quick" (`install.ps1:94`), and the session hook repeats it (`.claude/hooks/session-start.mjs:16`). In an empty folder there is nothing to map. If the user obeys, they enter a skill whose hard rules are "ONE QUESTION AT A TIME" and "get explicit approval" (`.claude/skills/context-generator/SKILL.md:55,58`) and whose question list covers dev server, test command, architectural pattern, entities, naming, coverage threshold, auth method, font (`:148-169`). **BAD ASK**. `00-core.md` precedence would let the Maestro skip the interview, but the installer told the user to invoke it directly. How much `--quick` trims was not verified beyond its one-line description (`:48`).
3. User writes the prompt. Amplifier shows a five-line English block (`.claude/rules/80-prompt-amplifier.md:18-27`); triage → Project → `/kickoff`.
4. Phase 1 `/discovery`: up to five questions with defaults, in one message (`.claude/skills/discovery/SKILL.md:23-26`). Good. Platform (iOS/Android/both) is correctly user-owned. `@product-manager` then writes the PRD with `/tlc-prd`, a skill built around a live interview and a rule that high-impact unclear points "stay an open question" (`.claude/skills/tlc-prd/SKILL.md:33,36-46`), run by an agent that cannot talk to the user (`.claude/agents/product-manager.md:3,28`). PLAUSIBLE: extra open questions come back and force the second round discovery promised not to have.
5. Checkpoint: confirm the v1 cut. Legitimate.
6. Phase 2 prototype. `@designer` in prototype mode builds "single-file HTML or the project's stack" (`.claude/agents/designer.md:36`). The user sees a web mock of a mobile app. Acceptable as a look-and-feel check; it says nothing about the riskiest mobile assumptions (device features, offline, push, store rules).
7. Phase 3 design. `ui-ux-pro-max` claims mobile (`.claude/skills/design/SKILL.md:17`). The gate that proves it is browser-only: widths 1440/1024/768/390/320, keyboard focus rings, `lang`/title/description (`.claude/skills/design/references/ui-gate.md:8,25,27`). Half of it does not apply to a native app; platform conventions (safe areas beyond one line, gestures, navigation patterns, permission prompts) are absent.
8. Phase 4 architecture. `@tech-lead` picks the stack. Reasonable. If the engines or stack skills are missing the user is pointed to `npx @tech-leads-club/agent-skills` and plugin installs (`optional/README.md:9-10,34`).
9. Phase 6 foundation, phase 7 build loop. Each roadmap item: task file → build → audit with the full T3 panel → deliver. `@qa-engineer`'s behavioural layer knows "API/CLI" and "Web UI → /playwright-skill" (`.claude/agents/qa-engineer.md:27-30`). There is no simulator, emulator or device step anywhere in rules, agents or templates (search for emulator/simulator/Expo/Flutter/React Native in `.claude/rules`, `.claude/agents`, `.claude/templates`: zero hits). Result: every UI acceptance criterion is `NOT VERIFIABLE`, or is "verified" in a browser build that is not what ships. **NO ANSWER**: the user gets an app that no agent has ever seen running on a phone, and the reports say "not verified" in a list they may not read.
10. Each item ends on its own branch `feat/<slug>` (`.claude/rules/50-git.md:5`). The user is asked "Faço push e abro PR?" (`.claude/skills/deliver/SKILL.md:30-32`) even if the folder has no remote and no GitHub account. **BAD ASK** when there is no remote. With "sim", a PR is opened and the flow ends at `SHIPPED` (`:37`); merge is Level C and no step asks for it (`.claude/rules/50-git.md:9`). With "não", commits stay on the branch. Either way `main` never advances. What item 2 is built on (item 1's branch, or `main` without item 1) is not defined. **STUCK**: by milestone review "run the full suite" (`.claude/skills/kickoff/SKILL.md:41`) there is no defined tree that contains the milestone.
11. Phase 8 release. `@devops` lists Vercel, Cloudflare, Netlify, Render (`.claude/agents/devops.md:3,23`). App signing, paid developer accounts, store review, TestFlight/internal testing have no owner. They are all Level C (money, accounts) but nobody prepares them or tells the user early that they are coming. **NO ANSWER** on "how do I get this on my phone".
12. Cost of the trip: eight phases; PRD, pre-mortem, prototype notes, design spec, tech spec, ADRs, threat model, roadmap, state file; then per item a task file, up to four reviewers, layered commits, and a retro per milestone. No preview of how long or how expensive this is and no way to ask for a lean run except the sentence "Small-but-new projects usually merge 3 into 2" (`.claude/skills/kickoff/SKILL.md:27`). **UNWANTED** for a first personal app: the document set of a funded team.

### (b) A dashboard over an existing database

1. Triage is ambiguous. "dashboard" appears as a Prototype trigger (`README.md:14`), a Design trigger (`.claude/skills/design/SKILL.md:3,17`) and would also fit Project. Three routes produce three different things: a throwaway mock with fake data, a designed screen, or an eight-phase project. The user cannot predict which they will get. **UNWANTED** risk is highest on the Design route: a polished screen on mocked numbers.
2. The rawest source (amplifier question 2) is the real schema and real data. Reading it needs a connection string. That is a secret (`.claude/rules/30-autonomy.md:29`), `.env` is unreadable by policy (`.claude/templates/settings.harness.json:46-47`), and "anything touching production data" is Level C (`.claude/rules/30-autonomy.md:25`) with no distinction between reading and writing. The user is stopped, legitimately, but late and without a recipe: nothing says "create a read-only user, put the URL in this variable, here is how". **STUCK**.
3. Once connected, the agents see real rows. No rule covers this: `60-security.md` is about code. Nothing on read-only roles, row limits, sampling, masking personal data, or keeping real records out of task files, logs and screenshots under `.specs/logs/`. `researcher.md:19` protects outbound queries only. **UNWANTED**: customer data in evidence files and in model context without the user having decided that.
4. Metric definitions ("cliente ativo", "receita", time zone, refunds) are the product here. Discovery caps questions at five and tells the Maestro to assume the rest (`.claude/skills/discovery/SKILL.md:19,24`). Assumed definitions go into an *Assumptions* list in a PRD the user probably skims.
5. Gates check that the screen renders, has states, is accessible (`ui-gate.md`). No gate checks that a number is right. The oracle list has "a real HTTP response, a browser run" (`.claude/rules/40-quality-gates.md:41`); reconciling a displayed figure against a figure the user already trusts is not in the method of any agent. **UNWANTED**, the most dangerous kind: a dashboard that passes every gate and shows plausible wrong numbers.
6. Delivery: same branch/merge gap as (a). "How do I open it" is not in the report. Hosting an internal dashboard that talks to a private database (network access, auth for viewers) has no guidance beyond the generic deploy path.

### (c) A data pipeline: ingest an API into a warehouse

1. Triage. The Ops tier is "CI, deploy, env, release, infra → @devops" (`.claude/rules/10-orchestration.md:25`) and `@devops` advertises "setting up pipelines" (`.claude/agents/devops.md:3`). The word "pipeline" can send a data-engineering product to the CI specialist. PLAUSIBLE misroute. Otherwise it lands in T3 or Project.
2. Prerequisites arrive one by one as Level C stops: the API key (secret), the warehouse (paid cloud resource, account), its credentials (secret) (`.claude/rules/30-autonomy.md:27,29`). Each stop is correct on its own; together they are three or four interruptions spread across phases because nothing collects "what I need from you" up front. **STUCK**, repeatedly.
3. Requirements. The PRD and task templates ask for user flows, UI states, an API-changes table and a data-changes table shaped for an application's own schema (`.claude/templates/task.md:26-32`). The questions that define a pipeline have no slot: schedule and freshness, full vs incremental load, idempotency and re-runs, backfill, late or duplicated records, schema drift at the source, rate limits and pagination, volume and cost per run, what happens on partial failure. Whether they get asked depends on the amplifier improvising them.
4. Build and proof. Test policy says mock at system boundaries (`.claude/rules/70-testing.md:5`). For a pipeline the boundary is the product: a mocked API and a mocked warehouse prove little. No agent's method includes a real sample run with row counts, a reconciliation against the source, or data-quality checks as acceptance evidence. A new external integration also triggers a threat model before build (`.claude/rules/60-security.md:15`), which is heavier than the pipeline itself for a personal project. **UNWANTED**.
5. Review. `@code-reviewer` checks correctness, contracts, tests, security (`.claude/agents/code-reviewer.md:25-32`). Nobody is asked whether a re-run duplicates rows.
6. Done. `SHIPPED` = PR URL (`.claude/skills/deliver/SKILL.md:37`). A pipeline that is not scheduled and not watched has delivered nothing. Scheduling is a deploy (Level C, fine) but outside `/kickoff` no route even proposes it, and no route covers "it failed last night" as an operating concern: no alerting, no run history, no owner. **NO ANSWER** on "is it running?".

### (d) An exploratory data-science question, with a notebook and a model

1. Triage has no row for analysis. T0 is "Question, explanation, opinion → answer inline. Read code if needed" (`.claude/rules/10-orchestration.md:15`): the user gets an opinion without the data being touched. Prototype gives a throwaway spike with "no tests, no review" and "commits" skipped (`.claude/skills/prototype/SKILL.md:13`). T2 forces a task file with acceptance criteria written before anything is known, which is the opposite of exploration. **UNWANTED** in all three: an unverified opinion, an analysis that is thrown away, or a feature-delivery process around a question.
2. No role owns it. `@ai-engineer` is explicitly for "features that call a model" and its evals are for LLM output (`.claude/agents/ai-engineer.md:3,14,25`). `@developer` builds slices from task files. Nobody's method contains: look at the data first, state a baseline, hold out a test set, check for leakage, report uncertainty, say what the data cannot answer.
3. No proof standard. The Definition of Done is typecheck/lint/build, scoped tests, code review (`.claude/rules/40-quality-gates.md:6-15`). A model with a leaked target passes all of them. The oracle list (`:41`) has nothing statistical.
4. Artifacts do not fit. Notebooks are reviewed as diffs (`code-reviewer.md:23`) and committed in layers "structure → logic → UI → tests → docs" (`.claude/agents/committer.md:15`); neither means anything for a notebook. Datasets and trained models collide with "never commit large binaries" (`committer.md:19`) with no alternative offered (where does the data live, how is the model versioned). Whether real data may be read at all has the same policy hole as (b).
5. The answer. The report shape is Done / Evidence (commands) / Changed (files) (`.claude/rules/90-communication.md:4-12`). A data-science answer is a finding, its confidence, the chart, the caveats and the next question. **NO ANSWER** in the form the user needs.
6. If the model is to be used afterwards (served, scheduled, retrained), nothing covers it.

### (e) A one-line bug report in an existing web app ("tá quebrando ao salvar o perfil")

1. Assumes the harness is already installed in that app. If it was installed today, the project section of `CLAUDE.md` has an empty commands table (`install.ps1:62-69`) and no `context/`. `/bugfix` does not trigger context generation (only `/blueprint` and rule 75 do, for T2+), so the Maestro discovers commands itself (`.claude/rules/70-testing.md:15`). Fine.
2. `/bugfix` step 1: "Ask the user for nothing you can get yourself" (`.claude/skills/bugfix/SKILL.md:11`). Good. To reproduce "saving the profile" the app must run and someone must be logged in. A test account password is a secret the project may not have → Level C stop. Legitimate, but the user is not told in advance and gets no recipe. **STUCK** (short).
3. Step 3: turn the reproduction into a failing test. A typical vibe-coded app has no test runner. Rule: "If none exists, creating one is part of the task" (`.claude/rules/40-quality-gates.md:41`). The one-line bug now includes choosing and installing a test framework. Level A, so not asked, and reported only if the Maestro treats it as Level B. **UNWANTED** scope, though defensible once; it should be said plainly and done once per project, not discovered inside a bug.
4. Fix, then `/audit`: `@code-reviewer` always, `@qa-engineer` because behaviour is user-facing (`.claude/skills/audit/SKILL.md:14-16`). Proportionate if the bug was real; heavy if it was a typo that slipped past the T1 exemption (`bugfix/SKILL.md:31`).
5. `/deliver` → `@committer` runs "the project's full test suite and typecheck/lint… Red → no commit" (`.claude/agents/committer.md:12`). In an existing app that never had a green lint or typecheck, the gate is red for reasons unrelated to the bug. The only exits are an explicit user waiver (`.claude/rules/50-git.md:4`) or a list of known failures in `context/TESTING-POLICY.md` (`.claude/rules/70-testing.md:13`) that nobody has been told to create on first contact. **BAD ASK / STUCK**: the user is asked to waive a gate, on every task, until someone builds the baseline.
6. Commits land on `fix/<slug>`; "Faço push e abro PR?" **BAD ASK** for a solo user who works on `main` and has not yet written the standing instruction; the question does offer to make it standing (`deliver/SKILL.md:34`), which fixes push but not merge.
7. Final report: root cause at `path:line`, regression test path, branch, hashes. Missing: "open the profile page and save; it works now" and "you are now on branch X". **NO ANSWER** to the only thing the user wanted to know: can I use it.

---

## 3. The ten most serious product gaps

Format: severity — file at fault — problem — who it hurts and when — proposed change in product terms.

1. **BLOCKER** — `.claude/rules/50-git.md:5,9`; `.claude/skills/deliver/SKILL.md:27-39`; `.claude/skills/kickoff/SKILL.md:40-41` — Finished work never reaches the main line. Every task gets its own branch; merge is user-gated; no step ever asks for it; `SHIPPED` means "PR open". What the next task is built on is undefined. — Every user from the second task on; fatal in `/kickoff`, where a milestone is many tasks and the milestone review needs one tree that contains them. — Make the solo default explicit: finished, gated work lands on the project's main line locally without a question; branch-and-PR becomes an opt-in standing instruction for people who collaborate. Define "delivered" as "on the main line and runnable", and state in every report where the work now lives.

2. **BLOCKER** — `.claude/rules/10-orchestration.md:11-27` (no tier); `.claude/templates/task.md:26-32,45-47`; `.claude/agents/ai-engineer.md:3`; `.claude/rules/40-quality-gates.md:6-15,41` — Data engineering and data science are not in the product. No route, no owner, no requirement slots (schedule, idempotency, backfill, freshness, data quality; baseline, holdout, leakage, uncertainty), no matching proof, no artifact conventions for notebooks, datasets or models. — The user on journeys (c) and (d): they receive web-feature process around non-web work, and gates that pass on wrong data or a leaked model. — Add project-type profiles (web app, mobile app, dashboard/analytics, data pipeline, analysis/model). A profile changes four things: what the requirement must answer, who does the work, what counts as proof, and what "delivered" means. Add an analysis route whose deliverable is a finding with confidence and caveats, not a commit.

3. **BLOCKER (for mobile)** — `.claude/rules/40-quality-gates.md:37`; `.claude/rules/70-testing.md:14`; `.claude/agents/qa-engineer.md:27-30`; `.claude/skills/design/SKILL.md:17,64`; `.claude/agents/devops.md:3,23` — The harness claims mobile UI but can only look at a browser. No simulator/device verification, no platform checklist, no build-signing-store path. — The user on journey (a), at every milestone and again at release: the app is reported done without ever being seen running, or sits at "not verified" forever. — Either support mobile properly (a mobile verification step that runs the app, a mobile UI gate, a "get it on my phone" release path with the paid-account and store decisions surfaced at discovery) or state in the README that mobile is not supported yet. A claim the gates cannot back is worse than an honest limit.

4. **MAJOR** — `.claude/skills/prototype/SKILL.md:13,32`; `.claude/rules/10-orchestration.md:16-17,22` — There are only two speeds: throwaway (no proof, must be rebuilt) and full process (task file, reviewer panel, layered commits) for anything over two files. The way a vibe coder actually works — get it running, look, iterate, harden what survives — has no route. — The user on most days. A four-file screen gets the same ceremony as a payment flow; a prototype they like must be rebuilt from scratch. — Add a middle mode and make it the default for personal projects: build it, run it, show it, keep it; rigor scales with risk (money, auth, user data, irreversible changes get the full panel; the rest gets one check and a run). Let a prototype be promoted in place, with the hardening it lacks listed and then done. Give the user one word to move the dial ("rápido" / "caprichado").

5. **MAJOR** — `.claude/agents/committer.md:12`; `.claude/rules/50-git.md:4`; `.claude/rules/70-testing.md:13`; `install.ps1:62-69` — No adoption path for an existing project. The commit gate assumes a green suite and typecheck; an inherited or vibe-coded codebase is red or has none. The escape hatch (a list of known failures) exists in a rule but no step creates it. — The user on journey (e), on the first task in any existing app, and on every task after it. — First contact with an existing project runs one adoption pass: discover commands, record the current state of tests/lint/typecheck as the baseline, and from then on gate on "nothing got worse". If there is no test runner, say so once and set it up once, as its own visible step.

6. **MAJOR** — `install.ps1:94`; `.claude/hooks/session-start.mjs:16`; `.claude/rules/75-context-docs.md:19`; `.claude/skills/context-generator/SKILL.md:55,58,148-169,305` — The first thing the product tells a new user to do is run a skill that interviews one question at a time and asks for approval, about things the autonomy rule says the team decides (naming convention, coverage threshold, architectural pattern). In an empty folder the instruction is also meaningless. — Every new user in the first five minutes; it contradicts the product's central promise before the first real prompt. — First-run should be zero-question: existing code → map it silently and report what was assumed; empty folder → say "tell me what you want to build". Bring the context skill under the autonomy rule in its own text, not only by precedence.

7. **MAJOR** — `.claude/rules/30-autonomy.md:25,27,29`; `.claude/rules/60-security.md:5`; `.claude/skills/discovery/SKILL.md:21`; no file for real-data handling — Two holes around the user's real systems. (i) Prerequisites that only the user can supply (keys, database access, accounts, paid resources) surface one at a time, mid-flow, with no instructions on how to supply them safely. (ii) There is no policy for working with real data: reading vs writing, read-only credentials, sampling, personal data in logs, screenshots and model context. "Touching production data" is one undifferentiated Level C line. — The user on (b), (c), (d) and often (e): repeated stops, then either a blocked team or real customer data copied into evidence files. — Collect a single "what I need from you" list at the end of discovery/blueprint, each item with the exact safe way to provide it. Add a data-handling policy: read-only by default, smallest sample that answers the question, no real records in files the team writes, and writes to real data always asked.

8. **MAJOR** — `.claude/rules/90-communication.md:4-17`; `.claude/skills/kickoff/SKILL.md:55-63`; `.claude/rules/80-prompt-amplifier.md:18-27`; `.claude/rules/00-core.md:46` — The product speaks engineer, in English templates, to a user who writes short Portuguese prompts and judges by looking. Reports list commands, paths and task files; none says how to open, run or try the result, what the user should look at, or where the work now lives. The amplifier prints five lines of method before every task. — Every user at the end of every task; the moment of value is the moment the report fails them. — Every report ends with "como ver": the exact command or URL, what to click, what should happen, in the user's language. Evidence moves below it. The amplifier collapses to one line unless the user asks to see it. Visual work includes the screenshot in the report, not a path to it.

9. **MAJOR** — `.claude/rules/30-autonomy.md:12`; `.claude/rules/85-self-improvement.md:45`; `.claude/skills/kickoff/SKILL.md:14-27` — No notion of the user's budget. Subagent dispatch is unlimited and free of announcement; a `/kickoff` commits the user to eight phases and a multi-reviewer loop per item without saying what it will cost in time or usage, and with no cheaper alternative offered. — The solo user on a subscription, mid-milestone, when the limit hits; and at the start, when they cannot tell a 20-minute request from a two-day one. — Before any Project or T3 route, show the plan in three lines with a rough size (phases, number of items, which reviews) and the lean alternative, then proceed. Add a per-project effort setting that the rigor dial (gap 4) reads. Size estimates are TBD until real runs are measured; measure them.

10. **MAJOR** — `.claude/rules/85-self-improvement.md:49-51`; `.claude/rules/30-autonomy.md:33`; `README.md:108` — Self-improvement learns the process but not the person, and does not travel. Standing instructions and lessons are per project; a fix made inside a project waits for the user to port it by hand to the harness repo; the user's stable preferences (stack, package manager, language of UI copy, taste, "never ask me X") have no home, so each new project re-decides or re-asks them. — The user on their second and every later project; the promise "improves over time" resets at each install. — Add a user-level profile that every project reads (preferences, standing instructions, answers already given) and that the team proposes additions to when it sees the same answer twice. Make upstreaming a fix a single user approval, not a manual port.

**Also noted (not in the ten).**
- MINOR — `.claude/rules/10-orchestration.md:25`, `.claude/agents/devops.md:3` — "pipeline" means CI here; a data pipeline can be misrouted to `@devops`. Fold into gap 2.
- MINOR — `.claude/skills/deliver/SKILL.md:30-32` — the push/PR question is asked even when the repository has no remote.
- MINOR — `.claude/templates/context/TESTING-POLICY.default.md:24-31` — default policy carries examples from another product (terminal sessions, tmux reattach); `.claude/templates/context/claude-md.md:85` suggests an 80% coverage threshold while the default policy says there is no 80% gate (`TESTING-POLICY.default.md:86-87`). A new project inherits a contradiction.
- MINOR — `install.ps1:36-37` — harness scripts are copied into the project's own `scripts/` folder and need Node even in a Python or SQL project; with `.specs/`, `context/`, `prototypes/`, `design-system/`, `AGENTS.md` the harness leaves a large footprint in a small project.
- MINOR — `.claude/agents/product-manager.md:28` with `.claude/skills/tlc-prd/SKILL.md:33,36-46` — a no-interview agent runs an interview-shaped skill; PLAUSIBLE source of extra open questions.
- MINOR — no "operate" phase anywhere: after release nothing owns "is it still working".

---

## 4. Over-built for a solo user — cut or make optional

| Item | Where | Why it is too much for one person | Proposal |
|---|---|---|---|
| Branch per task + PR + PR-comment handling + PR-level review | `50-git.md:5,11`; `deliver/SKILL.md:36-39`; `/gh-address-comments`; `/the-judge` | PRs exist so other people can review. The harness already reviews before commit; the PR adds a question and a stranded branch. | Opt-in "collaboration mode". |
| Layered atomic commits | `committer.md:15-16` | History hygiene for reviewers who do not exist; each layer must build on its own. | One coherent commit per task by default. |
| Full document chain for new projects | `kickoff/SKILL.md:18-25` | PRD + pre-mortem + prototype notes + design spec + tech spec + ADR files + threat model + roadmap + state before the first real line. The user reads perhaps the ten-line summary. | Lean kickoff by default: one page of "what and what not", a running skeleton, a short roadmap. Full chain when stakes are named (money, other people's data, a client). |
| Threat model for every new external integration | `60-security.md:15` | Calling any API triggers a formal threat model. | Keep for auth, payments, personal data, public exposure; drop for the rest. |
| Decision machinery | `/the-jury`, `/the-fool`, ADR files plus `context/DECISIONS.md` | Three decision tools and two places to record one decision. | One decision log; keep a single stress-test for irreversible choices. |
| Ten context files | `context-generator/SKILL.md:17-28`; `75-context-docs.md` | A small project gets ten memory files to keep true. | Start with one file; split only when a section outgrows it. |
| Retro at every milestone | `kickoff/SKILL.md:42` | Process review on a schedule, whether or not anything went wrong. | Only when incidents are open (the hook already knows). |
| Multi-runtime protocol | `AGENTS.md:3,10` | Support for Codex, OpenCode, Cursor for a user on Claude Code. | Remove from the core; keep as a note. |
| Roster size | 14 agents | Several roles differ mainly in name for a solo project (`@tech-writer`, `@explorer`, `@researcher` as separate hops; `@committer` as a specialist for one commit). The cost is hops, briefs and tokens. Which merges are safe is the tech lead's call. | Product ask only: fewer hops per ordinary task. |
| Amplified brief printed on every prompt | `80-prompt-amplifier.md:18-27` | Method shown to a user who wants outcome. | One line, or silent with `/amplify` to inspect. |
| Figma skills, Mermaid studio, accessibility audit skill as first-class | `optional/`, `.claude/skills/` | Rarely used by this user; each adds a description to the routing surface. | Optional, installed on demand. |

Not over-built, keep: the autonomy ladder, evidence-or-nothing, the state file for resuming, the root-cause discipline in `/bugfix`, an independent reviewer on risky work, the incident log.

---

## 5. The riskiest assumption about the user

**The harness assumes its user wants a software team's process and will judge the work the way an engineering manager does: by reading evidence, task files and specs, on a branch, in English, with no limit on time or usage.**

The stated user is the opposite on each point: one person, short Portuguese prompts, judges by seeing the thing run, pays for every agent hop, and has no one to open a PR for.

If the assumption is wrong, the failure is quiet. The user does not complain; they start prefixing prompts with "só faz" or use `/prototype` for everything, the gates stop running, and the product's actual value (proof) disappears while its cost (ceremony, files in the repo) stays.

How to find out (no data exists today — TBD): run the five journeys above for real with the user and record, per journey, (i) minutes and usage until the user first sees something running, (ii) number of times they were asked something, (iii) which generated documents they opened, (iv) whether they bypassed the route. One real project per profile is enough to settle it.

A second assumption, nearly as risky and independent: **that all software looks like a web codebase with a test suite, a browser and a git remote.** Gaps 2, 3 and 5 are all this assumption failing.

---

## 6. v1 cut — the three changes that matter most, in order

1. **Make delivery real for one person.** Work lands on the main line locally with no question; "delivered" means "there, runnable, and here is how to see it" in the user's language; existing projects get a recorded baseline so the gate means "nothing got worse". (Gaps 1, 5, 8.) First because it breaks or degrades every journey, including the two the harness otherwise does well, from the second task onward.

2. **Add a rigor dial with a lean default, and show the cost before a big route.** A middle mode between throwaway and full process; prototypes promotable in place; full panel reserved for named risk; a three-line plan with rough size before `/kickoff` or T3; zero-question first run. (Gaps 4, 6, 9.) Second because it decides whether the user keeps using the harness at all; without it the riskiest assumption in section 5 plays out.

3. **Project-type profiles, starting with the two that are furthest from working: data pipeline and analysis/model; then mobile.** Each profile defines what the requirement must answer, who does the work, what counts as proof, what "delivered" means, and what is needed from the user up front, including the real-data policy. Until mobile has a way to run and see the app, say in the README that it is not supported. (Gaps 2, 3, 7.) Third only because the first two are prerequisites for any profile to feel right; in terms of the stated standard ("any kind of software") this is the largest missing piece.

Deferred to later: user-level profile and one-step upstreaming (gap 10), operate phase, roster consolidation, trimming the optional skills.

---

## Out of scope of this evaluation

- How any of the above should be implemented (tools, file layout, agent design): `@tech-lead`.
- Quality of the vendored skills' own content.
- Whether the validator and scripts work: not run.
- Comparison with other harnesses.

## Assumptions made

- The user works alone, mostly on personal or small client projects, often without a git remote. Stated in the brief as "one person"; the no-remote case is my assumption.
- The user's runtime is Claude Code only.
- "Vibe codes" means: judges by running and looking, iterates on working software, has limited patience for documents. This reading drives sections 4 and 5; if the user in fact wants the full paper trail, gaps 4, 8 and 9 drop one severity level and section 4 shrinks.

---

## Round 2 — response to tech-lead

Responds to `.specs/docs/eval-ideal-harness-techlead.md`. Round 1 above is unchanged. I did not re-run anything; where I rely on something the tech lead ran (the validator failure on a short-form bugfix file, the zero-commit repository), I take their output as reported, not as verified by me.

**Overall.** The two reports agree on the substance of four items (brownfield gate, web-only verification, layer-split commits, scheduled retros) and reach them independently. They differ in what they optimise: the tech lead makes the existing process *true* (gates that really gate); I asked whether the process is the *right size* for one person. Both are needed, and the order between them is the main thing for a third reader to decide.

### R2.1 Their ten weaknesses — does this user feel it?

| # | Their weakness | Matters to the solo user | When the user actually feels it |
|---|---|---|---|
| 1 | Review gate has no defined diff | **HIGH** | Never directly; they feel it the day a feature that was reported "APPROVED" is broken, and from then on stop trusting every "proven" line. Paying for a review that looked at nothing is the worst trade in the product. |
| 2 | Every `/bugfix` dead-ends at `/deliver` | **HIGH** | On every bug fix, their second most frequent job: the fix exists but the run ends in `BLOCKED` or a detour to fill sections nobody needs. I missed this in round 1. |
| 3 | Task-file ownership contradiction, two writers | **LOW** | Only on a fan-out build, which is rare outside `/kickoff`; shows up as a slow, confused run, not as a wrong result. |
| 4 | Commit gate cannot pass on a red or absent suite | **HIGH** | First task in any existing project, and every task after it, as a repeated "may I skip the gate?" question. Same as my gap 5. |
| 5 | Verification defined for the web only | **HIGH** | Any mobile, pipeline or model work: "done" arrives without anyone having seen it run or checked a number. Same as my gaps 2 and 3. |
| 6 | Level C enforced by a web/JS list and prose | **HIGH** (rare, severe) | Not felt at all until the one time a store submission, a cloud change or a write to the real warehouse happens without a question. It is the mirror of "ask me only what is mine": here the user is *not* asked what is theirs. |
| 7 | Shared working tree; nothing checkpointed until the end | **Split: checkpoints HIGH, parallel isolation LOW** | Checkpoints: when a long run goes wrong and there is no "go back to before this" (a vibe coder's most used safety net). Isolation of parallel slices: only in large fan-outs. |
| 8 | Fixed context cost under-counted | **HIGH**, indirectly | As hitting the usage limit sooner and slower runs; the user never sees the number, only the bill. It is the measurable half of my gap 9. |
| 9 | Resumability stops at phase boundaries | **HIGH** | Every time they close the laptop or hit a limit mid-build and the next session redoes or skips work. The missing "abandoned" state matters more to this user than to a team: vibe coders drop many ideas, and each dropped one nags forever. |
| 10 | Instructions that cannot be executed as written | **LOW**, with one exception | Mostly invisible. Exception: the test-runner fallback "ask the user" is a bad ask, and the missing agent evals mean "the harness improves itself" is asserted, not shown, which touches job 8. |

No item is NONE. Three (3, 10, the isolation half of 7) are maintenance concerns the user would not notice for months.

### R2.2 Their three top changes against my "over-built for solo" list

**1. Git as substrate (branch at build start, worktree per slice, checkpoint commits, explicit diff).**
- Delivers real value: an undo point, a review that sees the real change, resumable work.
- Ceremony the user will not tolerate: a separate working copy per parallel slice with a merge step (more moving parts for a case that is rare for one person); a specialist hop for every checkpoint; `wip:` naming and squash-or-keep decisions (history hygiene, the same family as layer-split commits, which both reports cut).
- It also does not fix my gap 1: with all of this in place, work still ends on a branch or an open PR. The substrate is right; the destination is still a team's.
- Lightest version that keeps the value: save points taken automatically after each green step, with no naming rules and no extra agent; one promise to the user — "desfazer esta tarefa" always works; the review receives exactly the change of this task; finished work joins the main line locally. Parallel work in separate copies only when a build is actually fanned out; otherwise run slices in sequence.

**2. Project-declared verification profile.**
- Agree this is the right shape, and agree with their point that new domain agents are not the answer; it is the same idea as my "project-type profiles", from the proof side.
- Ceremony risk: it is an eleventh context file plus a reference menu plus a script, in a product where I already called ten context files too many; and if the profile is "declared" through the context interview, it becomes one more bad ask.
- Lightest version: the team infers the profile on first contact and tells the user in three lines ("neste projeto, 'provado' significa: …; 'entregue' significa: …"), stored as a section of the one project file, corrected by the user only if wrong. The baseline for existing projects is recorded in the same pass.
- What it still lacks (see R2.3): the requirement side and the meaning of "delivered" per kind of project. For a dashboard, the only real oracle is a figure the user already trusts — that is a user acceptance step and has to be asked for once, up front.

**3. Enforcement by hooks and scripts.**
- The guard on outward and production actions is not ceremony for the user; when it works they never see it, and it is what makes asking *fewer* questions safe. I support it more strongly than anything in my own round 1.
- Ceremony risk is ask-fatigue: categories that are too broad will prompt on harmless commands, and a user who is prompted often approves by reflex, which is worse than no guard.
- The validator extensions and task-file profiles are invisible to the user but are paid by the same person as maintainer: every script is something one person keeps working. Tie each new check to a logged incident, as rule 85 already demands.
- Lightest version: guard only the irreversible set (publish, deploy, store submission, cloud changes, writes to real data, reading secrets, rewriting history); fill the project-specific commands from the profile in change 2 rather than by hand; remember "sempre pode neste projeto". For bug fixes, make the short form simply valid instead of introducing named profiles.

One caution on combining 3 with the current process: mechanical enforcement of a process that is too heavy makes the heaviness impossible to escape. The size of the process has to be settled before, or together with, locking it in.

### R2.3 What their report misses about the user

1. **The user judges by seeing.** None of their three changes alters what the user receives at the end of a task. After all of them, the report is still commands and paths, and the work is still on a branch. They did not read `install.ps1`, so the first-run interview (my gap 6) is also absent.
2. **Proportion.** Their report makes every gate real and none smaller. For this user the more likely failure is not a gate that lies but a user who routes around the gates because a four-file change costs a full panel (my gap 4). A true gate nobody runs protects nothing.
3. **Domains are also a requirements problem.** A proof profile says how to check a pipeline; it does not make anyone ask about schedule, re-runs and backfill, or what "cliente ativo" means. And an exploratory analysis has no route at all: its deliverable is a finding, not a commit, so no oracle menu rescues it without a different shape of "done".
4. **Reading real data is a decision too.** They gate actions that change production; nothing in their report covers real customer rows ending up in logs, screenshots and evidence files (my gap 7).
5. **The user's budget, as the user sees it.** They measure the fixed context cost, which is valuable and which I could not. They do not propose telling the user what a route will cost before it starts, or offering a cheaper one.
6. **The user is also the only maintainer.** Hooks, three scripts, wider validation and thirteen eval files are a second product to maintain. That argues for their cuts (section 4 of their report, which I endorse in full) to land before their additions.
7. **Learning the person.** Nothing on preferences that should carry across projects (my gap 10).

If these were weighed, I expect their order would change in one place: the verification profile and the guard would stay, but "make delivery land and be visible" would sit beside their git change as one item, and the size of the process would be decided before it is enforced.

### R2.4 Where my round-1 report was wrong or overstated

1. **Journey (e) and job 2: I called `/bugfix` sound.** Per their run, its short-form task file fails the check the committer requires. My "PARTLY" for job 2 was right for the wrong reason, and the real problem is more frequent than the one I named.
2. **Gap 1, mechanism.** I speculated that stacked branches would inflate what the reviewer sees. Their reading is more accurate: at review time nothing is committed, so the reviewer's input is empty or arbitrary. The product conclusion (work never lands; "delivered" is undefined) stands, but the cause is "nothing is saved until the end", and my proposal should have included early save points.
3. **Journey (c), step 2: "each stop is correct on its own".** I assumed the Level C stops would happen. They show that for data, mobile and most cloud tooling nothing mechanical produces the stop. I overstated "too many interruptions" and missed "no interruption where one is owed". Gap 7 should have carried both.
4. **"One coherent commit per task" and `@committer` as an unnecessary hop (section 4).** Too blunt. Frequent saving is valuable to this user; what is ceremony is layering, naming and PRs. I withdraw the suggestion that committing is a candidate for removal.
5. **Gap 2, "no owner".** Overstated. I accept their argument that the gap is what counts as proof and what is gated, not who writes the code. I keep the claims about missing requirement questions and the missing analysis route.
6. **Gap 3, "or declare mobile unsupported".** Possibly too conservative. If a project can declare "run it in the simulator and capture the screen" as its proof, mobile verification may be within reach without a large investment. The release path (signing, store, paid account) remains missing either way. The user decision I raised stands but the cheaper option should be tried first.
7. **Consistency.** I criticised ten context files and then proposed profiles and a data policy without saying where they live. They belong inside what exists, not in new files.
8. **Order of my v1 cut.** I put the rigor dial second without knowing the review gate and the bugfix path are mechanically broken. Making what already runs actually work comes before resizing it.

Not withdrawn: gaps 4, 6, 8, 9, 10, and the riskiest assumption in section 5. Their fixed-cost measurement (roughly 15k tokens before each brief, per their estimate) strengthens gap 9.

### R2.5 Merged priority list (at most eight, by user value)

1. **A finished task is on the main line, runnable, undoable in one step, and the report says "como ver" in the user's language** — work is saved from the first edit, not only at the end.
2. **The checks the user already pays for must actually check**: the reviewer sees exactly this task's change, and a bug fix can be delivered without blocking or padding.
3. **Existing projects are adopted once, silently**: the current state of tests and lint is recorded and the gate becomes "nothing got worse", with zero questions on first run.
4. **Nothing irreversible or touching real systems runs without the user's yes, in any stack** — publishing, deploying, store submission, cloud changes, writes to real data, reading secrets — and real data is read-only, sampled and kept out of the team's files.
5. **Each project states in three lines what "proven" and "delivered" mean for its kind** (web, mobile, dashboard, pipeline, analysis), inferred by the team rather than interviewed, including the questions that kind of project must answer and a finding-shaped result for analyses.
6. **A rigor dial with a lean default**: full review for named risk, one check and a run for the rest, prototypes promotable in place, and a three-line plan with rough size before any large route.
7. **Interrupted work resumes where it stopped, and abandoned work can be closed** so it stops appearing.
8. **A smaller harness**: cut layer-split commits, scheduled retros, the PR machinery as default, duplicated protocol and second-opinion and web-only skills from the core, and count the real always-loaded size so it cannot grow unseen.

**Open disagreements for the deciding agent.**
- Whether item 6 (size of the process) must come before item 4's mechanical enforcement, as I argue, or after, as the tech lead's order implies.
- Whether parallel work in separate copies is worth its moving parts for a solo user, or sequential slices are enough until fan-out is common.
- Whether the verification profile is a new file with a script, or a section of the existing project file.
- Whether domain coverage is only a proof problem (tech lead) or also a requirements and route problem (me), specifically whether analysis needs its own route.
- Whether finished work lands on the main line by default (me) or stays branch-and-PR with the base made deterministic (implied by the tech lead).
