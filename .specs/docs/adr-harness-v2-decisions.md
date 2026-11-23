# ADR: harness v2 — which changes this harness gets

Date: 2026-11-11 · Author: `@ai-engineer` · Status: decided (fix-now items) / proposed (ask-first items)
Inputs: `eval-ideal-harness-techlead.md` (TL), `eval-ideal-harness-pm.md` (PM), `research-harness-engineering.md` (RS), all in `.specs/docs/`.
Policy that bounds this record: `.claude/rules/85-self-improvement.md`.

## 0. Basis and limits

| Checked | How | Result |
|---------|-----|--------|
| Three inputs | Read in full | — |
| 12 rules, `CLAUDE.md`, `AGENTS.md`, 9 agents, 13 skills, 3 scripts, hook, both settings files, both installers, task/state/claude-md templates, `evals/agents/explorer.md` | Read | — |
| `node scripts/validate-harness.mjs` | Run | `PASS (0 errors, 0 warnings)`, descriptions ≈ 5580 tokens |
| `node scripts/incident.mjs open` | Run | 6 open, all ×1 |
| Byte sizes | Measured with Node | Section 5 |
| What a subagent really loads | Observed in this run (I am a subagent) | `CLAUDE.md` + all 12 rules + every skill description: yes. `AGENTS.md`: **no** |

Not verified, and every ruling below inherits it: **no pipeline has been run end to end by anyone** (TL, PM, RS, or me). Claude Code facts used by the ask-first proposals (hook output contract, permission-pattern syntax, which shell tool the patterns cover) were not checked against current docs; they are preconditions in section 4, not assumptions.

Two facts that change the inputs' proposals:

1. **Cutting a branch from `main` by name while `main` never advances makes things worse.** Today task 2 accidentally sits on top of task 1. With TL's "always cut from the main line" and merge still unasked, task 2 would not contain task 1. So the deterministic base is a **recorded commit SHA**, and the branch model waits for the user's answer (Q1).
2. **`AGENTS.md` is not in context.** Trimming it saves maintenance, not tokens. The token money is in `CLAUDE.md` + rules (36,999 bytes harness-owned) and descriptions (22,321 chars), paid by the main thread and by every dispatch.

## 1. Rulings on the five open disagreements

| # | Disagreement | Decision | Reason |
|---|--------------|----------|--------|
| 1 | Size of the process before mechanical enforcement, or after | Order is: repair broken gates → cuts → rigor dial (Q3) → guard hook (Q2). The two are decoupled: the guard covers Level C *actions* only and never enforces a process step. | PM's risk ("locking in a heavy process") applies to process gates, not to an action guard; TL's risk (a dial on top of gates that review nothing) is real, so the dial waits for WO-3..WO-6. |
| 2 | Worktree per parallel slice, or sequential slices | No worktrees. No change to fan-out either. Log on first observed collision. | No incident, rare for one person, runtime support unverified; rule 85 forbids a rule for a hypothetical. |
| 3 | Verification profile: new file + script, or a section of the project file | A `## Verification` section in the project part of `CLAUDE.md`, one on-demand reference, and one script (`gate.mjs`) that reads the section. No `context/VERIFICATION.md`. | The section is already loaded where commands live; the script is what makes it a gate instead of prose. |
| 4 | Domain coverage: proof problem only, or requirements and route too | Requirements too: each kind of project gets "what the requirement must answer / proof / delivered / needs from user" in the reference. Analysis gets **one triage row**, no new skill, agent or pipeline. | Slots are cheap and on-demand; an analysis fits T2 once its acceptance criteria are method properties (baseline, holdout, re-run) and its deliverable is a finding. |
| 5 | Finished work lands on the main line by default, or stays branch-and-PR | User's call (Q1), recommended yes. Fix-now regardless: base recorded as a SHA, the landing question is finally asked (once, with an offer to make it standing), no push question without a remote. | Changing the default loosens `50-git.md` rules 3, 4 and 7; asking the Level C question that was never asked does not. |

## 2. Decision table

Tier: **fix** = fix-now (own authority, clearer or stricter) · **ask** = ask-first (section 4). Cost = effect on always-loaded context.

| ID | Proposal (source) | Decision | Tier | Reason | Cost |
|----|-------------------|----------|------|--------|------|
| D1 | Reviewer gets an explicit diff file with a defined base (TL1, PM R2.5-2) | ACCEPT, base = SHA recorded at `/build` start | fix | The one independent gate currently reviews nothing or the previous task | 0 |
| D2 | Create the task branch at `/build` start, cut from `main` by name (TL1) | REJECT as worded | — | Strands dependent tasks while `main` does not advance (section 0, fact 1) | — |
| D3 | Worktree per slice (TL7) | REJECT | — | Ruling 2 | — |
| D4 | `wip:` checkpoint commits after each green slice and fix round (TL7, PM "save points") | DEFER | — | Needs non-committer commits on a not-yet-gated tree (loosens `50-git.md` 1–2). D1's per-round patch files give the fix diff now. Revisit on the first incident of lost work | — |
| D5 | Work lands on the main line locally, no question; branch+PR opt-in; one commit per task instead of layers; `SHIPPED` = on main (PM1, PM/TL cuts) | ACCEPT in principle | ask Q1 | Changes git defaults | −0.2 KB if yes |
| D6 | Ask the landing question in `/deliver`; skip push/PR question when no remote (PM1, PM minor) | ACCEPT | fix | Asks a Level C question that was owed; removes a question about an impossible action | 0 |
| D7 | Short-form task file valid for bugfix/hotfix; one file-name convention (TL2; PM "no named profiles") | ACCEPT: profile inferred from the file name, flag optional | fix | Every bugfix dead-ends today | 0 |
| D8 | One writer for the task file; drop "one per slice" (TL3) | ACCEPT | fix | Two rules contradict four implementations | −30 B |
| D9 | States `CANCELLED`, `SUPERSEDED`, `BLOCKED(<previous>)`; log line per slice/round (TL9, PM R2.5-7) | ACCEPT | fix | Resume information is destroyed today; abandoned tasks nag forever | +60 B |
| D10 | Hook shows `COMMITTED` as "awaiting push" (TL9) | REJECT | — | Without a remote, committed is final; it would nag a solo user on every session | — |
| D11 | Single `## Proof` section instead of the amplified-brief block in the task file (TL cut) | DEFER to Q4 | — | Follows whatever the user decides about the amplifier | — |
| D12 | "Contract changes" section instead of the REST and table/entity tables (TL5) | ACCEPT | fix | Template is web-shaped | 0 |
| D13 | Gate = no new failures against a recorded baseline; adoption pass; `gate.mjs` (TL4, PM5) | ACCEPT, with the baseline accepted by the user once and recorded | fix | Resolves the `committer` vs `70-testing.md` contradiction; the waiver stays explicit, so nothing is loosened | 0 |
| D14 | Unpin agent models except `@explorer` (TL cut) | REJECT | — | No evidence; once the gate is a script the committer's model matters less | — |
| D15 | Project-declared verification + per-kind reference (TL5, PM2, PM R2.2) | ACCEPT (ruling 3, ruling 4) | fix | Central gap against "any kind of software" | +0.1 KB |
| D16 | `context/VERIFICATION.md` as a new context file (TL5) | REJECT | — | Ruling 3 | — |
| D17 | Domain agents: data engineer, mobile, ML (considered by both, rejected by both) | REJECT | — | Fails the isolation test in `agent-creator`: same tools, no fresh eyes, method only | — |
| D18 | Separate analysis route (PM2) | ACCEPT as one triage row | fix | Ruling 4 | +0.13 KB |
| D19 | Mobile: support it or say it is not supported (PM3) | ACCEPT: README states what is verified per kind | fix | A claim the gates cannot back | 0 |
| D20 | Real-data policy (PM7-ii) | ACCEPT: one line in `60-security.md`, detail in the reference | fix | Stricter; dashboards and pipelines read real rows | +0.2 KB |
| D21 | One "needs from you" list up front, with the safe way to provide each item (PM7-i) | ACCEPT in `blueprint`, `discovery`, task template | fix | Removes drip-fed stops | 0 |
| D22 | "Operate" phase; pipeline scheduling and monitoring as a route (PM) | REJECT as a phase | — | "Delivered means" in the reference covers scheduling; no project needs more yet | — |
| D23 | Data pipeline misrouted to `@devops` (PM minor) | ACCEPT: one description edit | fix | Cheap, real ambiguity | +30 ch |
| D24 | Narrow the threat-model trigger (PM cut, TL narrowed) | part of Q3 | ask | Loosens `60-security.md` rule 11 | — |
| D25 | `PreToolUse` guard hook by category; wider coverage for non-JS stacks (TL6, PM R2.5-4, RS#7 in part) | ACCEPT in principle | ask Q2 | Adds a hook; touches permissions | 0 |
| D26 | Replace blanket `Bash` allow with an allowlist or sandbox (RS#7) | REJECT | — | Per-project tuning and prompt fatigue destroy the product's main promise; Q2 covers the irreversible set | — |
| D27 | `PostToolUse`/`Stop` hook that runs checks after edits (RS#2) | REJECT | — | Stack-specific, slows every edit on large suites; `gate.mjs` at delivery is the mechanical sensor. Reopen on an incident "gate skipped" | — |
| D28 | Validator checks drift between the two settings files (TL6) | ACCEPT as a warning, harness repo only | fix | Projects may legitimately differ | 0 |
| D29 | Validator counts `CLAUDE.md` + rules and enforces a ceiling (TL8, RS#4) | ACCEPT, first work order | fix | The budget that grows is the one not measured | 0 |
| D30 | Validator messages carry remediation text (RS#3) | ACCEPT for every new check | fix | Free | 0 |
| D31 | Validator covers adapted skills on the pipeline path and section names skills read (TL10) | ACCEPT, explicit list, not auto-derived | fix | Auto-derivation would flag vendored files we do not edit | 0 |
| D32 | Fix `test-runner` dead references; `explorer.md:50` (TL10) | ACCEPT | fix | Unexecutable as written | 0 |
| D33 | Write the 13 missing agent evals (TL10, RS#9) | REJECT up front; ACCEPT "no eval → write the scenario that reproduces the incident before fixing" | fix | Evals grow where incidents happen; 13 speculative files rot | 0 |
| D34 | Rule 85 slimmed, detail moved to `/retro` (TL8) | ACCEPT; tiers table and "never self-approve a weakening" stay verbatim | fix | −1.8 KB in every context, no policy change | −1.8 KB |
| D35 | Amplifier: output shape to `/amplify`; one line by default (TL8, PM8) | — | ask Q4 | Rule 85 names rule 80 explicitly | −1.0 KB if yes |
| D36 | Keep Maestro-only rules (10, 90) out of subagent context (TL8) | REJECT | — | No verified mechanism scopes a rule to the main thread; cut duplication instead (D37) | — |
| D37 | Cut duplication in `CLAUDE.md`: skill list, "Routes at a glance", rules-index table (derived from TL8, RS§4, RS C1) | ACCEPT, guarded by a routing eval | fix | The runtime already injects every skill description; rule 10 already holds the triage table | −2.5 KB |
| D38 | Trim `AGENTS.md` to roster + pointers; drop multi-runtime protocol (TL cut, PM cut) | ACCEPT, low priority | fix | Removes drift; saves no tokens | 0 |
| D39 | "Como ver" + where the work lives in every report, in the user's language (PM8, TL agrees) | ACCEPT | fix | The moment of value | +0.2 KB |
| D40 | Zero-question first run (PM6) | ACCEPT in the callers (installer, hook, rule 75, `blueprint`) | fix | Contradicts the autonomy rule in the first five minutes | +60 B |
| D41 | Rewrite `context-generator` to drop its interview (PM6) | DEFER | — | Precedence in `00-core.md` plus caller wording should suffice; edit on the first observed interview | — |
| D42 | Start with fewer context files (PM cut; TL keeps GOTCHAS, DECISIONS, commands) | ACCEPT as caller wording: only files with real content | fix | Already the spirit of rule 75 | 0 |
| D43 | Plan preview in counts before a Project/T3 route (PM9, TL) | ACCEPT as three report lines, not a stop | fix | Lets the user redirect a two-day route | 0 |
| D44 | Cost estimates, effort budget, dispatch cap (PM9) | REJECT estimates; DEFER cap | — | An agent cannot read its usage; a number would be invented | — |
| D45 | Rigor dial, lean default, lean kickoff, prototype promoted in place (PM4, PM cut) | — | ask Q3 | Makes the harness more permissive | — |
| D46 | User-level profile across projects (PM10) | REJECT building one | — | `~/.claude/CLAUDE.md` and auto-memory already are that home, and no agent may edit them on its own | — |
| D47 | One-step upstreaming of project fixes (PM10) | DEFER | — | Zero pending fixes exist; build it when the first one hurts | — |
| D48 | `/retro` only when incidents are open (TL cut, PM cut) | ACCEPT | fix | Rule 85's own guardrail | −40 ch |
| D49 | Periodic "does this still pay" ablation (RS#1, 4/4 sources) | ACCEPT the hard ceiling (D29); DEFER the ablation procedure | — | Ablation needs agent evals that do not exist; writing it now would be another unexecutable instruction | — |
| D50 | Session start reads `git log`; baseline check before new work (RS#5) | REJECT | — | The runtime already injects branch, status and recent commits; the baseline is recorded at adoption | — |
| D51 | Rule on compaction, context resets, output offloading (RS#6) | REJECT | — | Always-loaded prose for what the runtime does | — |
| D52 | Drift sensors, validator in CI (RS#8) | DEFER | — | Repository has zero commits and no remote | — |
| D53 | Anti-placeholder instruction (RS#10, one source) | REJECT | — | No incident; reviewer already checks completeness | — |
| D54 | Known-good tags and reset procedure (RS#11) | REJECT | — | One commit per task plus `git revert` is the rollback | — |
| D55 | Dynamic model routing (RS#12); JSON task list (RS C5); reviewer calibration (RS C9) | REJECT | — | No incident, high cost | — |
| D56 | Remove "etiquette" and generic advice from rules 00, 60, 70, 90 (RS§6) | REJECT | — | RS itself rates the evidence weak; cutting rule 60 loosens security; no eval to detect a regression | — |
| D57 | Trim descriptions of `the-judge`, `the-jury`, `mermaid-studio` to ≤ 350 chars | ACCEPT | fix | −1.5k chars without removing anything | −1.5k ch |
| D58 | Move `the-judge`, `the-jury`, `mermaid-studio`, `web-accessibility` to `optional/` (TL cut, PM cut, RS§6) | — | ask Q5 | Removing a skill from the core | −1.4k ch if yes |
| D59 | Move `playwright-skill`, `frontend-design` to a web pack (TL cut) | REJECT | — | They are the web oracle and the design fallback; the pipeline calls both | — |
| D60 | Fold `@tech-writer`, `@product-manager`, `@ai-engineer` (TL ask 2) | REJECT | — | Saves ~300 tokens of description; an undispatched agent costs nothing else; each passes the isolation test on tools or model. Reopen on an incident of a wasted hop | — |
| D61 | Remove `@committer`, merge `@explorer`/`@researcher` (PM cut, withdrawn in R2.4) | REJECT | — | Risk boundary; untrusted web text must not sit next to write access | — |
| D62 | One decision log instead of ADR files + `DECISIONS.md` (PM cut) | REJECT | — | Rule 75 already says an ADR file only "when substantial" | — |
| D63 | Harness scripts out of the project's `scripts/` (PM minor) | DEFER | — | Cosmetic, touches every reference | — |
| D64 | `TESTING-POLICY.default.md` foreign examples; 80% threshold contradiction (PM minor) | ACCEPT | fix | Two templates contradict each other | 0 |
| D65 | `@product-manager` runs interview-shaped `tlc-prd` (PM minor) | DEFER | — | PLAUSIBLE only | — |
| D66 | Reword `60-security.md` for non-web stacks (TL5) | REJECT | — | Harmless where it does not apply | — |

## 3. Work orders (ACCEPT + fix-now), in execution order

Rules for the executor: one work order at a time; after each, run its proof and `node scripts/validate-harness.mjs`; log the new incident keys with `incident.mjs add` **before** the change and close with `incident.mjs fix` + one `CHANGELOG.md` line after the proof. New scripts are added to both installers' copy lists and to the script list at `scripts/validate-harness.mjs:147`. Every new validator or script error message ends with `— fix: <what to do>`.

### WO-0 — Evals first (no harness behaviour changes)

Closes: nothing; it is the baseline the later orders are measured against. Precedent: closed incident `validator-script-untested-edge` (a script shipped untested).

1. Create `evals/scripts/selftest.mjs` (harness repo only, not installed). It builds throwaway git repositories under `os.tmpdir()`, runs the harness scripts against them and asserts exit code and one stdout substring per case. Output: one line per case `ok|FAIL <name>`; exit 0 only if all pass. Start with cases for today's behaviour of `validate-task.mjs` (a full valid file passes; a file without `## Approach` fails).
2. Create `evals/routing.md`: 14 prompts with the expected first route, and a results table. Cases: "adiciona login com Google" → `/blueprint`; "tá quebrando ao salvar o perfil" → `/bugfix`; "produção caiu" → `/hotfix`; "quero ver como ficaria um dashboard assim" → `/prototype`; "quero criar um app mobile de X" → `/kickoff`; "cria a tela de configurações" → `/design`; "o CI tá vermelho" → `@devops`; "qual banco usar?" → `@tech-lead`; "documenta esse módulo" → `@tech-writer`; "troca o texto do botão para Salvar" → T1 inline; "o que essa função faz?" → T0; "você esqueceu de rodar os testes de novo" → log incident; **R11** "cria um pipeline que puxa a API X para o BigQuery todo dia" → `/blueprint` or `/kickoff`, never `@devops`; **R12** "por que as vendas caíram em março? os dados estão em vendas.csv" → T2 with the analysis kind, never a T0 opinion.
3. Run it once: dispatch `@tech-lead` (model `inherit`, so the Maestro's model; it loads the same rules) READ-ONLY with the 14 prompts and "name the tier and the first skill or agent the rules in your context prescribe; use no tools". Record the answers as the baseline row. R11 and R12 are expected to fail now.

Proof: `node evals/scripts/selftest.mjs` → exit 0; `evals/routing.md` has a dated baseline row.

### WO-1 — Budget meter (D29, D28, D30)

Incident to log: `budget-undercounted` [tool] — "validator counts descriptions only; CLAUDE.md + rules (37 KB) uncounted, so the fixed cost can grow unseen".

`scripts/validate-harness.mjs`:
- Compute `alwaysBytes` = bytes of `CLAUDE.md` up to the line `# Project` + bytes of every `.claude/rules/*.md`. Keep `budget` (description chars).
- Constants at the top: `MAX_ALWAYS_BYTES = 37000`, `MAX_DESC_CHARS = 22400` (today: 36,999 and 22,321). Above either → ERROR.
- Report line becomes: `… · always-loaded: constitution+rules <n> B (≈<n/4> tok, max <m>) · descriptions <n> ch (≈<n/4> tok, max <m>)`.
- Harness repo only (`install.ps1` exists): compare `permissions.allow|ask|deny` of `.claude/settings.json` and `.claude/templates/settings.harness.json` after normalising a trailing `:*)` and ` *)` to the same token; set difference → warning listing the items; two syntaxes in use → warning "verify which form the installed Claude Code honours".

Proof: validator prints `36999` and `22321`, PASS with exactly one warning (two syntaxes). Selftest case: a temp root whose rule file pushes the total over the ceiling → exit 1.

### WO-2 — Pay first: cuts (D34, D37, D38, D48, D57)

Incident to log: `always-loaded-duplication` [rule] — "CLAUDE.md restates the triage table of rule 10 and the skill list the runtime already injects; rule 85 carries its batch procedure in every context; AGENTS.md restates rule 20".

1. `CLAUDE.md` (constitution part): delete `## Skills` except its last paragraph (stack-specific skills and design engines), which moves under `## Team`. Delete `## Routes at a glance` (source of truth: the triage table in `10-orchestration.md`). Replace the `## Rules index` table with one line that still names all 12 file names (the validator requires each) and "lower number wins". Target: constitution ≤ 1,800 bytes (from 4,213).
2. `.claude/rules/85-self-improvement.md` → ≤ 2,600 bytes (from 4,320). Keep verbatim: the `## Tiers` table; "Never self-approve a weakening"; "Evidence before rules"; "Vendored engines are not edited"; the `incident.mjs add` command line; "log (step 1), finish the user's task, then run `/retro`". Compress "What counts" to one sentence listing the seven signals. Replace loop steps 2–5 with "cause, fix, proof and closing: `/retro` steps 2–4". "Watch the budget" becomes "The validator enforces a ceiling on always-loaded text: to add, cut." Move "Smallest change at the cause", "One source of truth", "Every rule carries its reason" and "Where fixes live" detail into `.claude/skills/retro/SKILL.md` step 4.
3. `.claude/skills/kickoff/SKILL.md` build loop step 5: "Run `/retro`…" → "Run `/retro` only if `node scripts/incident.mjs open` lists incidents." `.claude/skills/retro/SKILL.md` description: remove "at the end of every /kickoff milestone,".
4. Frontmatter `description` of `the-judge`, `the-jury`, `mermaid-studio`: ≤ 350 chars each, keeping what it does and when to use it (body untouched).
5. `AGENTS.md`: keep the header, `## Roster` (the validator parses it) and `## Non-negotiables`; replace Operating model, Contracts, Who calls whom, Pipelines and the state-machine line with pointers to `10-orchestration.md` and `20-delegation.md`. Delete the multi-runtime sentence and bullet.
6. Lower the constants: `MAX_ALWAYS_BYTES` = measured value + 800 (headroom for WO-4..WO-8, which add ≈ 760 bytes), and it must be ≤ 33,600. `MAX_DESC_CHARS` = 20,900.

Proof: validator PASS and prints constitution+rules ≤ 32,800 B, descriptions ≤ 20,800 ch. Re-run the routing eval (WO-0 step 3): the 12 non-data cases give the same routes as the baseline. A case that changed → restore the cut that caused it, do not argue with the eval.

### WO-3 — The reviewer sees this task's change (D1)

Closes: `review-gate-sees-wrong-diff`.

New `scripts/task-diff.mjs`:
- `node scripts/task-diff.mjs <task-file> --init` — if the file has no line `Base: …`, insert `Base: <sha> (<branch>)` after the `## Status:` line, from `git rev-parse HEAD` and the current branch; unborn `HEAD` → `Base: EMPTY (<branch>)`. Never overwrites. Prints the line. Exit 0; not a git repository → exit 1.
- `node scripts/task-diff.mjs <task-file>` — scope = the back-ticked path of each `- ` line in `## Files`. Changed set = files that differ from Base in the working tree (staged or not) plus untracked, non-ignored files; with `EMPTY`, every tracked or untracked non-ignored file. Writes `.specs/logs/diff-<task-file-basename>-r<n>.patch` (`n` = 1 + highest existing) containing the patch of in-scope changed files, untracked ones as new-file patches. Stdout: `diff: <path> · <k> files · +<a>/−<b>`; `outside ## Files: <paths|none>` (changed since Base but not listed; names only); for `n` > 1, `changed since r<n-1>: <paths|none>` (files whose patch section differs from the previous round's file).
- `node scripts/task-diff.mjs --base <ref>` — no task file: whole working tree against `<ref>` (default `HEAD`), written to `.specs/logs/diff-adhoc-r<n>.patch`.
- Exit codes: 0 patch written · 2 in-scope diff is empty (`— fix: nothing to review; check Base and ## Files`) · 1 usage, missing `Base:` line, or not a repository.

Edits:
- `.claude/templates/task.md`: after the status comment add `<!-- Base: written once by scripts/task-diff.mjs --init -->`.
- `.claude/skills/build/SKILL.md`, the line "Set the task file `Status: IN_PROGRESS` first": add "then `node scripts/task-diff.mjs <task-file> --init`". `.claude/skills/bugfix/SKILL.md` step 6: same call when the file is created.
- `.claude/skills/audit/SKILL.md`: Input line → "…or empty (ad-hoc: `task-diff.mjs --base HEAD`)". New first action of step 1: run `task-diff.mjs <task-file>`; exit 2 → do not dispatch, return to `/build`. Brief `CONTEXT` → `task file <path>; diff file <path>; changed outside ## Files: <list>; context docs <list>`. Files listed as outside are either added to `## Files` (and the script re-run) or named as unrelated in the brief. Step 3: after a fix, re-run the script and pass the new diff file, the `changed since` list and the findings to re-check.
- `.claude/agents/code-reviewer.md` Method 1 → "Read the diff file named in the brief. No diff file → produce it with `node scripts/task-diff.mjs <task-file>`; exit 2 → `BLOCKED: empty diff`. Never derive the change from `git diff <branch>...HEAD`." Line 41 → "On a re-review, read the files in `changed since` and check each prior finding."
- `.claude/agents/committer.md` Method 5: `<base>..HEAD` → "`<Base sha from the task file>..HEAD`".

Proof (selftest cases): zero-commit repo on `master` with two new files → exit 0, patch contains `+` lines of both; committed repo, one tracked file edited, one untracked in scope, one unrelated dirty file → patch has the first two, `outside ## Files:` names the third; nothing changed → exit 2; second run after editing one file → `changed since r1:` names only that file; `--init` twice → one `Base:` line.

### WO-4 — Task files that validate, resume and have one writer (D7, D8, D9)

Closes: `bugfix-taskfile-fails-validator`. Log and close: `taskfile-two-writers` [rule] — "rules say one task file per slice; blueprint, template, build and validator use one file with a slices table; parallel developers all edit it"; `task-state-not-resumable` [tool] — "BLOCKED overwrites the status it must restore; no terminal state for abandoned work; no log line per slice".

- `scripts/validate-task.mjs`: option `--profile full|short`; default `short` when the file name matches `^task-(fix|hotfix)-`, otherwise `full`. `short` requires only `Problem`, `Acceptance criteria`, `Files` and skips the Proof check; every other check is unchanged. Status regex additionally accepts `BLOCKED\((PLANNING|IN_PROGRESS|IN_REVIEW|READY_TO_COMMIT)\): .+`, `CANCELLED`, `SUPERSEDED: .+` (plain `BLOCKED: .+` stays valid). Summary line prints the profile.
- `.claude/skills/bugfix/SKILL.md` step 6: short form = Problem, AC, `## Files`. `.claude/skills/hotfix/SKILL.md`: `hotfix-<slug>.md` → `task-hotfix-<slug>.md` (table and step 2).
- `.claude/hooks/session-start.mjs:25`: closed set → `^(SHIPPED|COMMITTED|CANCELLED|SUPERSEDED)`.
- `.claude/templates/task.md:4` comment and `10-orchestration.md` "Progress": add the two terminal states and `BLOCKED(<previous>): <reason>`, "restore the status written in the parentheses". Same file, gate table row "Task file": `✔ (one per slice)` → `✔`.
- `20-delegation.md` "Parallel work": "gets its own task file and an explicit file scope" → "gets its slice ID and an explicit file scope; the Maestro is the only writer of the task file".
- `.claude/agents/developer.md` Method 7 → "Do not edit the task file. Return one evidence line per acceptance criterion in `EVIDENCE`." `FILES` line: drop "task file path".
- `.claude/skills/build/SKILL.md` "After a fan-out" step 1: add "write each slice's AC evidence into the task file and append one `## Log` line per returned slice and per applied `INTEGRATION:` change".

Proof (selftest): `task-fix-x.md` with Problem, 2 ACs, Files → PASS (today: FAIL, 6 errors); same content named `task-x.md` → FAIL; statuses `BLOCKED(IN_PROGRESS): waiting key`, `CANCELLED`, `SUPERSEDED: task-y` → valid; `BLOCKED(DONE): x` → invalid. Hook run in a temp dir with one `CANCELLED` task prints no `open tasks` line.

### WO-5 — Instructions that can be executed (D31, D32, D33)

Closes: `stale-refs-in-vendored-skill`. Log and close: `instruction-not-executable` [agent] — "explorer may write a map file but has no Write tool; retro requires agent evals that exist for 1 of 14 agents".

Do it in this order so the check is seen failing first:
1. `scripts/validate-harness.mjs`: add `ADAPTED_SKILLS = ['test-runner','test-generator','security-checker','lessons-writer']` to the `owned` list. New check on every owned file: each back-ticked `` `## <Heading>` `` must be a heading of some `.claude/templates/*.md`, or be in `KNOWN_HEADINGS = ['Handoff']` (extend this constant only with headings that exist somewhere real).
2. Run the validator. Expected: FAIL, including `test-runner/SKILL.md — references unknown section "## Escopo de teste"`. Any other error it reveals in the four adapted skills is fixed in this order.
3. `.claude/skills/test-runner/SKILL.md`: line 8 → `## Test scope`; line 10 "ask the user" → "report `no scope found` and run nothing"; line 15 "CLAUDE.md §2" → "the Commands table in the project section of `CLAUDE.md`"; line 32: drop the fallback in parentheses; line 35 → "The full suite is not run here; that is the `@committer` gate."
4. `.claude/agents/explorer.md:50` → "Keep the whole answer under 60 lines. Asked for a full map, return it in the answer; the caller saves it."
5. `.claude/skills/retro/SKILL.md` step 4.3 and `.claude/skills/harness-check/SKILL.md` §3 → "Agent changed → re-run its scenarios in `evals/agents/<name>.md`. None exists → first write one scenario that reproduces the incident (`/agent-creator` step 8), see it fail, then fix."

Proof: step 2 output shows the error; after steps 3–5 the validator returns PASS.

### WO-6 — A gate a brownfield project can pass (D13, D64)

Closes: `brownfield-gate-unpassable`.

New `scripts/gate.mjs`:
- Input: `[--root <path>] [--only <gate name>] [--timeout <seconds>]`. Reads `<root>/CLAUDE.md`, section `## Verification`, the table whose header row starts `| Gate`. Row = `| <name> | \`<command>\` | <baseline> |`.
- Baseline grammar: `exit0` (default when empty) — passes when the command exits 0. `max:<N>:<regex>` — passes when the number of output lines matching `<regex>` is ≤ N, whatever the exit code (regex may not contain `|`).
- Runs each command through the shell from `<root>`; full output to `.specs/logs/gate-<name>.log`. Stdout per gate: `PASS <name> (exit 0)`, `PASS <name> (31 ≤ 37)`, `FAIL <name> (41 > 37)` followed by the last 40 output lines; `ratchet: <name> 31 < 37 — lower the baseline` as a hint.
- Exit codes: 0 all pass · 1 at least one FAIL · 2 `NO GATE DEFINED` (no section, no table, or no rows) · 3 unreadable table, or a `max:` row without a line starting `Baseline accepted:` in `CLAUDE.md` (`— fix: ask the user once to accept the baseline and record it under Standing instructions`).
- The commands come from the project's own `CLAUDE.md`, which is trusted configuration; nothing from fetched or generated content is ever written into that table without the Maestro reading it.

Edits:
- Both installers, project-section template: Commands table keeps `Dev`, `Test (scoped)`, `Build`; add
  ```
  ## Verification
  Kind: <web | mobile | dashboard | pipeline | analysis | cli-lib | infra>
  | Gate | Command | Baseline |
  |------|---------|----------|
  | Surface | Proves it | Command or step |
  |---------|-----------|-----------------|
  Delivered means:
  ```
- This repository's `CLAUDE.md` project section: the same block with gates `harness | node scripts/validate-harness.mjs | exit0` and `selftest | node evals/scripts/selftest.mjs | exit0`.
- `.claude/agents/committer.md` hard rule 1 → "Gate once, before the first commit: `node scripts/gate.mjs`. Exit 1 → no commit; return the failures. Exit 2 or 3 → no commit; return `BLOCKED` with the script's `fix:` line. Only `GATE WAIVED BY USER` in the brief skips this (hotfix). A gate longer than the foreground limit runs in the background and is awaited." Description: "Runs the full test + typecheck gate" → "Runs the project's declared gate".
- `50-git.md` rule 2 → "**Never commit on a red gate.** `node scripts/gate.mjs` must pass (or the user waives it explicitly). A baseline other than green exists only with the user's recorded acceptance."
- `70-testing.md` rule 6: "listed in `context/TESTING-POLICY.md`" → add "and encoded in the gate baseline (`## Verification`)".
- `.claude/templates/context/TESTING-POLICY.default.md`: remove the examples that belong to another product (terminal sessions, tmux); add a `## Accepted baseline` section (date, what is red, user's words). `.claude/templates/context/claude-md.md:85`: delete the 80% coverage line.
- Adoption steps go in the reference created in WO-7, section 1 (text given there).

Proof (selftest fixtures, Node only): project with a green command → exit 0; `max:1:^not ok` with one failing test and a `Baseline accepted:` line → exit 0; add a second failing test → exit 1 (the mutation check: the gate must be able to fail); same without the accepted line → exit 3; no `## Verification` → exit 2. `node scripts/gate.mjs` in this repository → exit 0.

### WO-7 — Verification is declared by the project, for any kind of software (D12, D15, D18, D19, D20, D21, D23, D42)

Closes: `web-only-verification`. Log and close: `real-data-no-policy` [rule] — "no rule on reading real data: credentials, sampling, real records in logs, screenshots and task files".

New `.claude/skills/build/references/verification.md`, **at most 120 lines**, four sections:
1. **Adoption** (first T2+ task in a repository with code and an empty Gate table): discover commands from manifests and CI config; run each once; green → row with `exit0`; red → measure (failing count, error count) and ask **one** question for all of them: "N testes falhando e M erros de lint já existiam. Aceito isso como linha de base e passo a bloquear só o que piorar? — recomendado: sim". Yes → `max:` rows, `Baseline accepted: <date> — <summary>` under Standing instructions, details in `context/TESTING-POLICY.md`. No answer → rows stay `exit0` and commits stay blocked, reported as such. No runner at all → declare the cheapest real check that exists (compile, parse, build) and say once that there is no test runner; setting one up is its own task when the first `YES` triage row appears. Fill `Kind`, the Surface table and `Delivered means` by inference and state them in three lines in the report; the user corrects only if wrong.
2. **Kinds** — one table, columns *Requirement must answer · Proof · Delivered means · Needs from user up front*. Rows and their essential content: **web** (flows and states · tests, HTTP call, browser · running at a URL or locally · test account). **mobile** (platforms, offline, permissions · declared simulator/emulator or UI-test command with a screenshot; none declared = NOT VERIFIED; the iOS simulator needs macOS · installable build on a device · developer account, signing). **dashboard** (metric definitions, grain, time zone, source of truth · each headline figure reconciled against a figure the user already trusts, plus the UI gate · viewers can open it · read-only database URL, one trusted figure per metric). **pipeline** (schedule and freshness, full or incremental, idempotent re-run, backfill, late and duplicate records, schema drift, rate limits, partial failure · sample run on a dev target with row counts, source-to-target reconciliation, a second run that adds zero rows · scheduled and its failure is visible · source key, dev target, write credentials for dev only). **analysis/model** (question, baseline, metric, split, what the data cannot answer · holdout metric against the baseline, leakage check, re-run from a fixed seed gives the same numbers · a finding with confidence, caveats and next question in `.specs/docs/research-<slug>.md` · data location, permission to read it). **cli-lib** (public contract · tests, real invocation, install-from-package smoke test, API diff · versioned artifact · registry credentials at publish time). **infra** (state, blast radius, promotion · plan or dry-run output read line by line · applied with approval · cloud credentials).
3. **Real data**: read-only role, `LIMIT`/sample first, aggregate before copying, never paste rows into task files, logs, screenshots or handoffs, every write is Level C.
4. **Long runs**: background execution with a log file, fixed seeds, artifacts outside git with their location recorded.

Edits (always-loaded files: reword in place, net growth ≤ 450 bytes in total):
- `40-quality-gates.md` "Verification beats inspection" → "…an automated test → running the real thing through the surface's declared oracle (`## Verification` in `CLAUDE.md`; menu per kind: `.claude/skills/build/references/verification.md`) → reading the code." "UI gate": "run in a real browser" → "run on the real surface (a browser for web, the declared simulator or device command for native mobile)". "What can prove it": add "a reconciliation against a trusted figure, a holdout metric against a baseline, a plan or dry-run output".
- `70-testing.md` rule 7: "verifies in a real browser (`/playwright-skill`)" → "verifies on the real surface with its declared oracle (web: `/playwright-skill`)".
- `10-orchestration.md` triage: new row `| **Analysis** | A question about data, an exploration, a model | T2 route with the analysis kind: criteria are method properties, the deliverable is a finding |`.
- `60-security.md`: new item 12 — "**Real data:** read-only credentials, the smallest sample that answers the question, no real records in task files, logs, screenshots or handoffs; any write to a real system is Level C."
- `.claude/agents/qa-engineer.md` Method 4: new bullet "Mobile, data, model, infra → the command declared in `## Verification`; none declared → `NOT VERIFIABLE` and say what to declare."
- `.claude/skills/design/SKILL.md` step 6: "in a real browser" → "on the real surface: a browser for web; for native mobile the project's declared simulator or device command, and without one the result is NOT VERIFIED".
- `.claude/templates/task.md`: replace `## API changes` and `## Data changes` with `## Contract changes (if any)` — table `| Surface | Change | Notes |` and a comment with examples (endpoint, table or column, schema or grain, schedule, model input/output, CLI flag, public type). Rename `## Open user decisions` to `## Needs from user` with the comment "Level C only: decisions, credentials, access, paid resources, each with the safe way to provide it. Empty = proceed." `.claude/skills/blueprint/SKILL.md`: step 5 names the new sections and "read the project's kind row in the reference"; step 7 "ask it once" → "ask everything in `## Needs from user` in one message"; Output line `API: <n> · Data: <n>` → `Contracts: <n>`. `.claude/skills/discovery/SKILL.md` step 6: the ten-line summary gains "preciso de você: <list>".
- `.claude/agents/devops.md` description: "setting up pipelines" → "setting up CI/CD pipelines (not data pipelines)".
- `README.md`: new short section "O que o time consegue provar" with one line per kind taken from the Proof column, including: mobile only with a declared simulator/emulator command, iOS simulator does not run on Windows, signing and store release are not covered.

Proof: validator PASS (it checks that the reference path exists) and within the ceiling. Routing eval re-run: R11 and R12 now pass and the other 12 are unchanged. `wc -l` of the reference ≤ 120.

### WO-8 — First run asks nothing; delivery is visible (D6, D39, D40, D43)

Closes: `work-never-lands-on-main` (conservatively: the question is asked; the default flips only with Q1). Log and close: `first-run-interview` [skill] — "installer and session hook tell a new user to run an interview-style skill, also in an empty folder"; `report-not-user-verifiable` [rule] — "final report has no way to see the result and does not say where the work lives".

- `install.ps1:94`, `install.sh:80`, `README.md:46` → "Next: open the project in Claude Code and write what you want. Existing code is mapped on the first task, without questions."
- `.claude/hooks/session-start.mjs:16` → `[harness] no context/ docs yet — mapped silently on the first T2+ task (rule 75)`.
- `75-context-docs.md`, the line "No `context/` in the project…" → "No `context/` and the repository has code, on a T2+ task → `/context-generator --quick` without interviewing (infer; write only files that have real content; list assumptions in the report), then the adoption steps in `.claude/skills/build/references/verification.md` (Level A)." `.claude/skills/blueprint/SKILL.md` step 2: replace its own sentence with a pointer to that line.
- `.claude/skills/deliver/SKILL.md` step 3 → "`git remote` prints nothing → never ask about push or PR. A standing instruction covers landing → follow it. Otherwise ask once: 'Commits em `<branch>` (gate verde). Junto na `<base branch>` local[ e faço push]? — recomendado: sim. Quer que vire o padrão deste projeto?'" Step 4: brief carries `APPROVED: merge` and/or `push`/`pr`. Step 6: delete the duplicated template, point to rule 90.
- `.claude/agents/committer.md` Method 7: add "`APPROVED: merge` → switch to the base branch named in the task file's `Base:` line and merge the task branch"; `SHIPPED` is set "with the PR URL, or `merged into <base> @<hash>`".
- `90-communication.md` rule 2 template: after `Done:` add `How to see it: <exact command or URL, what to do, what should happen>` and `Where it lives: <branch @ commit; merged / pushed / local only>`; add "Labels and text in the user's language."
- `.claude/skills/kickoff/SKILL.md`, before the Phases table: "Plan preview (not a stop): three lines — phases that will run and which are skipped, expected number of roadmap items, reviewers per item — and the leaner alternative. Then proceed."

Proof: validator PASS within the ceiling; hook run in an empty temp dir prints the new line; `grep -n "context-generator" install.ps1 install.sh` → no match. Behaviour is proven only by the run in section 6.

### WO-9 — Close out

Set `MAX_ALWAYS_BYTES` to the measured value rounded up to the next 100 (must be ≤ 33,600) and `MAX_DESC_CHARS` likewise (≤ 20,900). `node scripts/gate.mjs` → exit 0. `node scripts/incident.mjs open` → `no open incidents`. `CHANGELOG.md` has one line per key. README counts corrected.

## 4. Ask-first: five yes/no questions for the user

| # | Question | Recommendation | If he says nothing |
|---|----------|----------------|--------------------|
| Q1 | Em projeto solo, o padrão passa a ser: trabalho pronto e com gate verde entra na linha principal local, um commit por tarefa, sem pergunta; branch + PR vira opção ("modo colaboração")? | **Sim.** | Branch por tarefa continua; `/deliver` pergunta uma vez por projeto se junta na principal e oferece tornar padrão (WO-8). Commits em camadas continuam. |
| Q2 | Posso adicionar um hook que pede confirmação antes de qualquer ação irreversível em qualquer stack (publicar, deploy, loja, mudar nuvem, escrever em dado real, ler segredo, reescrever histórico)? | **Sim**, depois do teste de 3 minutos da seção 6-b e de `@researcher` confirmar o contrato do hook. Escopo: só o conjunto irreversível, decisão "perguntar" (nunca negar), lista extensível pelo projeto em `## Verification`, teste em tabela com ≥ 40 comandos (zero falso negativo, ≤ 1 falso positivo, incluindo `cd x && git push` e `git -C x push`). | Sem hook. A lista de confirmação continua cobrindo só git, npm e quatro hosts web; o README passa a dizer isso. |
| Q3 | Modo enxuto como padrão: tarefa comum = um revisor + o Maestro roda o oráculo declarado; superfície sensível força o painel completo; `/kickoff` funde fases e só gera a cadeia completa de documentos quando há risco nomeado; protótipo aprovado pode ser promovido no lugar passando pelo `/audit`; threat model só com credencial, dado pessoal ou exposição pública? | **Sim, mas só depois** de WO-3..WO-6 provados em uma tarefa real (seção 6-a). | Nada muda: painel e fases como hoje. |
| Q4 | O amplificador passa a mostrar uma linha, no seu idioma, e o bloco completo só com `/amplify`? | **Sim.** Corta ≈ 1 KB de toda sessão e subagente e leva junto o bloco de quatro linhas do task file (D11). | Bloco de cinco linhas continua em todo prompt T2+. |
| Q5 | Posso mover `the-judge`, `the-jury`, `mermaid-studio` e `web-accessibility` para `optional/` (instaláveis sob demanda)? | **Sim.** Sobram `/audit` e `/the-fool` para segunda opinião. | Ficam no núcleo, com descrições já encurtadas (WO-2). |

If Q1 is yes: `50-git.md` rules 3–4, `committer.md` rules 3–4, `deliver` steps 2–3 and the installers' Standing-instructions default change; `task-diff.mjs` and the `Base:` line need no change. Not asked, because the answer is no: folding three agents (D60), allowlisting Bash (D26), a post-edit hook (D27).

## 5. Context budget

Measured today (bytes; tokens at 4 bytes each):

| Always loaded, main thread and every subagent | Now | Target after WO-9 | After Q4 + Q5 |
|---|---|---|---|
| `CLAUDE.md` constitution part | 4,213 | ≤ 1,800 | same |
| 12 rules | 32,786 | ≤ 31,800 | ≤ 30,800 |
| Skill + agent descriptions (chars) | 22,321 | ≤ 20,900 | ≤ 19,500 |
| **Total** | **59,320 (≈ 14.8k tok)** | **≤ 54,500 (≈ 13.6k tok)** | **≤ 52,100 (≈ 13.0k tok)** |

The project section of `CLAUDE.md` (1,300 bytes here) is project content and outside the ceiling.

| Paid in | Bytes | Paid out | Bytes |
|---|---|---|---|
| Rule 10: analysis row, states | +200 | Rule 85 slimmed to tiers, triggers, guardrails | −1,765 |
| Rule 40: declared oracle | +100 | `CLAUDE.md` skill list | −870 |
| Rule 60: real data | +210 | `CLAUDE.md` routes block | −979 |
| Rule 90: how to see it, where it lives | +220 | `CLAUDE.md` rules-index table → one line | −620 |
| Rule 75, rule 20 | +30 | Three vendored descriptions trimmed | −1,560 |
| **Added** | **+760** | **Cut** | **−5,794** |

On-demand text: `verification.md` ≤ 5,000 and `retro` +600 against `AGENTS.md` −3,700 and `deliver` −350: about +1,550. Text overall: about −3,500 bytes. Code grows: three scripts (`task-diff.mjs`, `gate.mjs`, `evals/scripts/selftest.mjs`), roughly 350 lines, each with selftest cases. That is the deliberate trade: prose out, checks in. From WO-1 on the ceiling is enforced by the validator, so a later addition must cut something to pass.

## 6. What I am least sure about, and the cheapest test

**a. Whether the repaired pipeline is actually followed end to end.** Every finding in the three inputs and every ruling here comes from reading. The scripts are proven by the selftest; that the Maestro calls them at the right step is not.
Test (about 15 minutes, after WO-8): a scratch folder with a five-file Node project, `node --test` with one test already failing, no remote, one planted bug. Install the harness, open Claude Code there, type "tá quebrando: soma(2,2) devolve 5". Record: (1) questions asked — expected exactly two, baseline acceptance and landing; (2) `.specs/logs/diff-task-fix-*-r1.patch` exists and is non-empty before the reviewer is dispatched; (3) `gate.mjs` exits 0 on the baseline and the commit is made; (4) the final report has "how to see it" and "where it lives" in Portuguese; (5) nobody suggested running `/context-generator`. Each miss is an incident with the step that failed. This run also decides when Q3 becomes safe.

**b. Whether Level C is mechanically enforced at all on this machine.** `.claude/settings.json` writes `Bash(git push:*)`, the template writes `Bash(git push *)`, and the machine's primary shell is PowerShell; a `Bash(...)` pattern may not cover commands sent through another shell tool. Not verified.
Test (3 minutes, in a scratch repository with the installed settings): have the agent run `git tag t1`, `cd . && git tag t2`, `git -C . tag t3`, once through each shell tool it has. Every one that runs without a prompt is a hole. The result settles the syntax to keep, and whether Q2 is urgent or merely useful.

**c. Whether the `max:<N>:<regex>` baseline is too crude.** It counts lines; a suite where one failure is fixed and another appears passes. Accepted as the smallest stack-neutral mechanism.
Test: run the adoption steps on one real existing project of the user with a red lint; then break one more thing; `gate.mjs` must exit 1. If counting is not enough there, add a second baseline form `ids:<file>` (set of failing identifiers) instead of parsing per runner.

**d. Whether the cuts in WO-2 change routing.** Guarded by the 14-case routing eval, which is a cold agent's classification and only approximates the Maestro. Test (a) is the real check.

## 7. User answers (2026-11-11)

The user answered all five questions with "follow the recommendations". Recorded as:

| # | Answer | Effect |
|---|--------|--------|
| Q1 | Yes | Solo default: finished, gated work lands on the local main line, one commit per task, no question. Push and PR stay Level C. Apply after WO-8. |
| Q2 | Yes, conditional | Guard hook only after the 3-minute test in section 6-b and after `@researcher` confirms the hook contract in the current official docs. |
| Q3 | Yes, deferred | Lean mode becomes the default only after WO-3..WO-6 are proven on a real task (section 6-a). Until then the panel is unchanged. |
| Q4 | Yes | Amplifier shows one line; the full block only with `/amplify`. Apply after WO-8. |
| Q5 | Yes | Move `the-judge`, `the-jury`, `mermaid-studio`, `web-accessibility` to `optional/`. Apply after WO-8. |
