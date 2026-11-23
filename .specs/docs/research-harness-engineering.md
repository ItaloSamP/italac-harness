# Research: what practitioners mean by "agent harness" / "harness engineering", and how this repo measures up

Date of research: 2026-11-11. Repo state: C:\Estudos\workflow (harness itself; 14 agents, 37 skills, 12 rules; `node scripts/validate-harness.mjs` = PASS, 0 warnings).
Method: sources fetched with Node `fetch`/curl, HTML stripped, read end to end. Nothing reconstructed from memory.

## 1. Sources

### S1 — Gist "Best Practices for Building an Agent Harness"
- URL: https://gist.github.com/celesteanders/21edad2367c8ede2ff092bd87e56a26f (read via the gist `/raw` URL)
- Reached: YES (raw URL, HTTP 200, full text).
- Author: gist owner `celesteanders` (the text itself names no author). Date: not stated. It says it "consolidates Anthropic, OpenAI and community research" and cites Anthropic Nov 2025 and Mar 2026, OpenAI Feb 2026, so it is 2026 or later. It is a second-hand synthesis.
- Core claims:
  1. Split work into planner / generator / evaluator. Agents grade their own work too generously, so a separate skeptical evaluator is more tractable (§1).
  2. Stay monolithic (single-agent loop) until a specific ceiling is hit. Multi-agent is "microservices plus non-determinism" (§1, §10).
  3. Context is ephemeral. Persist state in files: a JSON task list (never reorder or remove items, only flip status), progress notes, the spec, an init script, git history (§2).
  4. The repo is the system of record. AGENTS.md/CLAUDE.md should be a ~100-line map pointing at deeper docs, with progressive disclosure (§2).
  5. Session protocol: orient → setup → verify baseline → one task → implement → test through the real UI/API → update state and commit → clean exit. One task per session (§3).
  6. Automated verification as fast "backpressure" (types, lint, tests, scanners, browser automation). The evaluator needs concrete criteria, few-shot calibration, hard thresholds, and sprint contracts (§4).
  7. Context is scarce. The main window acts as scheduler; subagents do read-only fan-out (high parallelism) and limited-parallelism writes; deterministically reload the core files each loop (§5).
  8. Defence in depth: OS sandbox, filesystem confinement, command allowlist (§7).
  9. Enforce invariants mechanically (linters with remediation messages), run recurring cleanup "garbage collection", make the app inspectable (worktree boot, DevTools, logs/metrics) (§8).
  10. Every harness component encodes an assumption about what the model cannot do. Re-test on each model upgrade by removing one component at a time. Let the agent update CLAUDE.md with learnings. Git is the safety net: tag known-good states, reset and re-run, periodically regenerate the plan (§6, §9, §10).

### S2 — Medium, "AI Agent Best Practices: Production-Ready Harness Engineering 2026 Guide" (@tort_mario)
- URL: https://medium.com/@tort_mario/ai-agent-best-practices-production-ready-harness-engineering-2026-guide-c1236d713fac
- Reached: **NO.** Plain fetch returned HTTP 403 with a Cloudflare "Just a moment... Enable JavaScript and cookies" page (58 bytes of text). A web search for the title and author found no copy that could be verified as the same article; the closest hit was a differently titled besthub.dev page, which was NOT opened, so its authorship is unverified. A third-party paywall/Cloudflare proxy (freedium) was attempted and blocked by the permission classifier; I did not work around that.
- Author per URL: `@tort_mario`. Date: unknown.
- Core claims: none recorded. **This source is excluded from every count below.** Counts are out of 4 readable sources (S1, S3, S4, S5). If you want S2 counted, paste its text or open it in a browser session.

### S3 — X article "The architect's guide to harness engineering: How to choose or build the one for you"
- URL: https://x.com/thealexker/article/2076741193367761378
- Reached: YES (plain fetch, HTTP 200; article text is in the server-rendered HTML).
- Author: Alex Ker (@thealexker, Baseten). Date: the page shows "Jul 13" with no year. It mentions GLM 5.2 and LangChain Harness Profiles, so 2026 is likely but unverified. 9 min read.
- Core claims:
  1. Harnesses fall into 3 categories: frameworks/SDKs (Vercel AI SDK, Anthropic Agent SDK, Mastra), extensible (Pi, Deep Agents), turnkey (OpenCode, Codex, Claude Code, Cursor).
  2. Choose by harness-task fit and by your fluency with it. Non-engineers should buy, not customize. Engineers customize. Joint post-training of harness and model is the frontier that most teams do not need.
  3. Eight diagnostic properties: context and state within a task; memory across tasks; MCP/tool support; standard adherence (open vs proprietary layout); model-selection flexibility; remote access; observability/debugging (including rollback and self-repair); hackability (opinionated vs composable).
  4. Documenting recurring pitfalls in a file, encoding codebase structure in a root `.md`, and disconnecting unused tools all reduce wasted context and tokens.
  5. Context rot is a primary cause of quality loss. Subagents compartmentalize work and keep context clean.
  6. The future is routing: a lightweight classifier sends tasks to cheap, specialist or frontier models. Small fast models for read-only research. Routing must be cache-aware.
  7. Serving and performance (rate limits, caching, batching) are part of harness-task fit.
  8. Models and harnesses must co-evolve. Pick non-negotiables and become fluent in one harness.

### S4 — LangChain, "The Anatomy of an Agent Harness"
- URL: https://www.langchain.com/blog/the-anatomy-of-an-agent-harness
- Reached: YES (plain fetch, HTTP 200).
- Author: Vivek Trivedy. Date: March 10, 2026.
- Core claims:
  1. Definition: Agent = Model + Harness. A harness is "every piece of code, configuration, and execution logic that isn't the model itself".
  2. Harness includes: system prompts; tools/skills/MCPs and their descriptions; bundled infrastructure (filesystem, sandbox, browser); orchestration logic (subagents, handoffs, model routing); hooks/middleware for deterministic execution (compaction, continuation, lint checks).
  3. Method: work backwards from a desired agent behaviour to a harness feature.
  4. The filesystem (plus git) is the most foundational primitive: durable storage, offload, a collaboration surface, rollback.
  5. Bash/code as a general-purpose tool, run inside sandboxes with allow-listed commands and network isolation. Browsers, logs and test runners give self-verification loops.
  6. Memory = AGENTS.md-style files injected at start, plus web search/MCP for post-cutoff knowledge.
  7. Context rot is handled by compaction, tool-output offloading (head/tail kept, full output on disk) and skills as progressive disclosure.
  8. Long-horizon work needs durable state, planning, and self-verification. The "Ralph loop" is a hook that intercepts exit and reinjects the prompt in a fresh context.
  9. Models are post-trained with their harness in the loop, so harness and model are coupled. Harness changes alone moved their agent from Top 30 to Top 5 on Terminal Bench 2.0.
  10. Some harness functions will be absorbed into models, but the environment, tools, durable state and verification keep mattering. Open problems: hundreds of parallel agents, agents analysing their own traces to fix harness failures, just-in-time tool and context assembly.

### S5 — Martin Fowler site, "Harness engineering for coding agent users"
- URL: https://martinfowler.com/articles/harness-engineering.html
- Reached: YES (plain fetch, HTTP 200).
- Author: Birgitta Böckeler (Thoughtworks). Date: 02 April 2026 (supersedes a 17 Feb 2026 memo).
- Core claims:
  1. Narrows the generic Agent = Model + Harness to a user-built "outer harness" around a coding agent, whose built-in parts (system prompt, retrieval, orchestration) are the "inner" harness.
  2. Goals: raise the chance of a correct first attempt and self-correct before human review. That reduces review toil and wasted tokens.
  3. Two control types: guides (feedforward, steer before acting) and sensors (feedback, observe after acting). Feedback-only repeats mistakes. Feedforward-only never learns whether the rules worked.
  4. Two execution types: computational (deterministic and fast: tests, linters, type checkers, structural tests) and inferential (LLM review/judge: slower, probabilistic). Linter messages written for LLM consumption are "a positive kind of prompt injection".
  5. The human's job is the steering loop: when an issue recurs, improve a guide or sensor. AI can help build the controls.
  6. "Keep quality left": cheap sensors before commit, costly ones post-integration, continuous drift/health sensors outside the change lifecycle.
  7. Three regulation categories: maintainability (easiest), architecture fitness, and behaviour (hardest; AI-written tests are not trusted enough). Correctness is outside any sensor's remit if the human did not specify it.
  8. Harnessability and "ambient affordances": typed languages, clear module boundaries and conventions make a codebase easier to harness. Harness templates per service topology reduce variety (Ashby's Law).
  9. Humans carry an implicit harness (taste, accountability, org memory). A harness externalizes part of it, and should direct human input to where it matters, not eliminate it.
  10. Open questions: keeping guides and sensors coherent as they grow, and measuring harness coverage the way mutation testing measures tests ("if sensors never fire, is that quality or poor detection?").

## 2. Consolidated definition

Shared core (S4, S5): the harness is everything in an agent system except the model. S5 narrows it for coding-agent users to the "outer harness" they build with guides and sensors. S3 uses the word for the whole product (Claude Code, Codex, OpenCode). S1 never defines it and uses it operationally.

Components. "Count" is out of the 4 readable sources. S2 is not counted.

| # | Component | Named by | Count |
|---|-----------|----------|-------|
| C1 | Guides / feedforward: instruction files (AGENTS.md/CLAUDE.md), skills, system prompt, conventions. Kept short, progressive disclosure | S1 §2, S3 (pitfalls .md), S4 (memory files, skills), S5 | 4/4 |
| C2 | Tools / MCP / skills / browser, i.e. the actions the model can take | S1 §4, S3 (MCP property), S4, S5 (skills, code mods, LSP) | 4/4 |
| C3 | Self-improvement loop: recurring failures turn into a better guide or sensor | S1 §6 and §10, S3 (document rough edges), S4 (agents analysing own traces), S5 steering loop | 4/4 |
| C4 | Sensors / verification feedback: tests, linters, type checkers, hooks, browser checks, with fast turnaround | S1 §4, S4 (hooks, self-verification), S5 | 3/4 (S3 only via observability) |
| C5 | Durable state and memory: filesystem, git, progress files, task list | S1 §2, S3 (memory across tasks), S4 | 3/4 |
| C6 | Context management: compaction, offloading, subagents to protect context, progressive disclosure | S1 §5, S3, S4 | 3/4 |
| C7 | Orchestration: subagents, handoffs, routing | S1 §1 and §5, S3 routing, S4 | 3/4 |
| C8 | Mechanical enforcement of invariants, "shift left" | S1 §8, S4 (lint hooks), S5 | 3/4 |
| C9 | Independent evaluation / inferential review separate from the generator | S1 §1 and §4, S4 (self-evaluate), S5 (inferential) | 3/4 |
| C10 | Observability, rollback, recovery | S1 §9, S3, S4 (git rollback) | 3/4 |
| C11 | Re-evaluate and strip harness parts as models improve | S1 §10, S3 (co-evolution), S4 (absorbed into model) | 3/4 |
| C12 | Session/long-horizon protocol: orient, baseline verify, one task, clean exit; Ralph loop | S1 §3, S4 | 2/4 |
| C13 | Sandbox / permission isolation / command allowlist | S1 §7, S4 | 2/4 |
| C14 | Model coupling, selection and routing across models | S3, S4 | 2/4 |
| C15 | Continuous drift/health sensors; harness coverage metrics; harnessability | S1 §8 (garbage collection), S5 | 2/4 |
| C16 | Remote access, serving and performance | S3 only | 1/4 |

Disagreements, kept visible:
- Breadth of the definition. S4 says everything but the model. S5 says that is "very wide" and narrows it to the user's outer harness. S3 equates it with a product category.
- Multi-agent vs single-agent. S1 says single agent until proven insufficient (§1, §10). S1 also recommends a planner/generator/evaluator split. S3 and S4 push subagents and routing as the direction. Nobody except S1 states a "when not to" rule.
- Fate of the harness. S4 and S1 say parts will be absorbed by models, so strip them. S3 says harness and model co-evolve and fluency matters more. S4 also shows harness-only changes move benchmarks a lot.
- Fresh context vs compaction. S1 favours resets with handoff artifacts but notes stronger models may make compaction enough.
- State format. S1 wants a JSON task list because markdown corrupts more easily. S5 and S4 do not take a position.
- Where correctness comes from. S5 says no sensor reliably catches misdiagnosis, over-engineering or misread instructions, and the behaviour harness is unsolved. S1 treats an evaluator with a browser as the answer.
- Opinionated vs composable (S3). More opinionated means safer but stifling. More hackable means more risk (security, token burn).

## 3. Conformance of this repository

Legend: PRESENT / PARTIAL / ABSENT. Paths are relative to the repo root.

| Component / principle | Status | Where, or the gap |
|---|---|---|
| C1 guides: short entry file | PRESENT | `CLAUDE.md` is 95 lines, an index to `.claude/rules/` (CLAUDE.md "Rules index"). |
| C1 guides: progressive disclosure | PARTIAL | Skills and agents load on demand, but the 12 rule files + CLAUDE.md are always loaded, about 38 KB (`cat CLAUDE.md .claude/rules/*.md \| wc -c` = 38299). The validator only measures the description budget (`scripts/validate-harness.mjs:152`, ~5.6k tokens). See §4. |
| C2 tools/skills | PRESENT | 37 skills in `.claude/skills/`, per-agent `tools:` lists (e.g. `.claude/agents/explorer.md:4`, read-only plus Bash). Playwright skill for browser. |
| C3 self-improvement loop | PRESENT | `.claude/rules/85-self-improvement.md` (log → find cause → tier → prove → close); `scripts/incident.mjs`; `.specs/harness/incidents.jsonl`; `/retro` (`.claude/skills/retro/SKILL.md:53` budget check); session hook surfaces open incidents (`.claude/hooks/session-start.mjs:30-43`). |
| C4 sensors: deterministic | PARTIAL | The validator and task validator exist (`scripts/validate-harness.mjs`, `scripts/validate-task.mjs`), and `.claude/rules/40-quality-gates.md:31` ranks tests above inspection. But no hook runs lint, test or typecheck after an edit. `.claude/settings.json:53-65` registers only `SessionStart`. Quality gates depend on prose instructions. |
| C4 sensors: LLM-readable error messages | ABSENT | Validator errors are plain (`scripts/validate-harness.mjs:15-16`), with no remediation text. (S1 §8, S5.) |
| C5 durable state | PRESENT | `.claude/rules/00-core.md:13` (state lives in files); task files `.claude/templates/task.md:3` with a status machine; `.specs/STATE.md` and `ROADMAP.md` via `/kickoff` (`.claude/skills/kickoff/SKILL.md:10`); commits via `@committer`. |
| C5 state format | PARTIAL | Markdown status line, parsed by regex (`.claude/hooks/session-start.mjs:24`), not the JSON that S1 §2 recommends. Low risk, since the status is validated (`scripts/validate-task.mjs`). |
| C5 git history read at start | ABSENT | The session hook does not read `git log` (`.claude/hooks/session-start.mjs`). S1 §3 and S4 name it. The repo has zero commits (gitStatus), so it could not be tested here. |
| C6 context management | PARTIAL | Subagents for heavy reading (`.claude/rules/10-orchestration.md:33-40`) and `@explorer` on haiku (`.claude/agents/explorer.md:5`). No tool-output offloading, and no guidance on compaction or context resets. |
| C7 orchestration | PRESENT | `.claude/rules/10-orchestration.md` (tiers, inline vs dispatch), `.claude/rules/20-delegation.md` (brief and handoff contracts, 4 in flight at `:80`, hot files at `:78`). |
| C7 model routing | PARTIAL | Per-agent `model:` field (haiku / sonnet / inherit), static, no classifier (S3). |
| C8 mechanical enforcement | PARTIAL | `scripts/validate-harness.mjs` enforces structure (broken references, handoff blocks). Policies in `00-core.md` through `90-communication.md` are prose only. `.claude/rules/50-git.md:10` "no `--no-verify`" is also enforced by `.claude/settings.json:43`. |
| C9 independent evaluation | PRESENT | `.claude/rules/10-orchestration.md:32` ("the author never grades its own work on T2+"), `@code-reviewer`, `@qa-engineer`, `@security-auditor`, fix loop at `.claude/rules/40-quality-gates.md:27`. |
| C9 concrete graded criteria / calibration | PARTIAL | Severities defined (`.claude/rules/40-quality-gates.md:19-26`), external oracle required (`:41`). No few-shot calibration or hard thresholds per criterion. |
| Sprint contract before work | PRESENT | Task file with acceptance criteria and DONE WHEN (`.claude/templates/task.md:18`, `.claude/rules/20-delegation.md:20`). The reviewer does not negotiate it. |
| C10 recovery | PARTIAL | `@committer` and local branches (`.claude/rules/50-git.md:3`) and `git reset --hard` is gated (`.claude/settings.json:20`). No tag of known-good states, no rollback procedure. |
| C10 observability | PARTIAL | Incident log and `.specs/logs/`. No traces or metrics (not applicable to a rules-only repo, but a downstream project would need them). |
| C11 re-evaluate on model change | ABSENT | No trigger or procedure in `.claude/rules/85-self-improvement.md` or `.claude/skills/retro/SKILL.md` to remove components when the model improves. The "watch the budget" line (`85-self-improvement.md:45`) is the nearest. |
| C12 session protocol | PARTIAL | `/kickoff` resume (`.claude/skills/kickoff/SKILL.md:12`) and the session hook cover orient. Baseline verification before new work is not required by any skill (`.claude/skills/build/SKILL.md:23-24` loads docs only). One task per session is not stated. |
| C13 sandbox/permissions | PARTIAL | Deny/ask lists (`.claude/settings.json:16-51`), `.env` reads denied. But `"Bash"` is allowed wholesale (`:14`), so there is no command allowlist and no OS sandbox. |
| C14 model coupling/selection | PARTIAL | See C7. |
| C15 drift / health sensors | PARTIAL | `@explorer` drift brief (`.claude/skills/harness-check/SKILL.md:37`, `evals/agents/explorer.md`) is on demand only. Nothing recurring. |
| Agent evals | PARTIAL | `evals/agents/` holds one file (explorer). 14 agents. |
| Anti-placeholder prompt (S1 §6) | ABSENT | No instruction against stub implementations in `.claude/agents/developer.md` or `/build`. |
| Capture bugs immediately (S1 §6) | PARTIAL | Harness incidents are captured (`85-self-improvement.md:19`). Project bugs seen in passing go to "left alone and reported" (`50-git.md:12`), not into a plan file. |
| C16 remote/serving | ABSENT | Outside this repo's remit. Not a gap by S3's own framing (property of the host tool). |

## 4. What the repo does that the sources warn against

| Practice | Source warning | Where |
|---|---|---|
| Large always-loaded instruction set (~38 KB, 12 rule files auto-loaded every session, plus roster `AGENTS.md`) | S1 §2: entry file "should be a map, not an encyclopedia" (~100 lines) because a giant file crowds out the task and rots. S3 and S4: context rot, load on demand. | `CLAUDE.md:15-30` says rules are "auto-loaded from `.claude/rules/`"; `.claude/rules/*.md` total 669 lines. `CLAUDE.md` itself is fine (95 lines). |
| 14 agents and 37 skills for a rules-only repo, as default structure | S1 §1/§10: stay monolithic until a demonstrated ceiling. Multi-agent complexity compounds. | `.claude/agents/` (14), `.claude/skills/` (37), `CLAUDE.md` Team section. Mitigated: `.claude/rules/10-orchestration.md:3` already says "inline whenever cheapest". |
| Policy enforced by prose where a hook/check could enforce it | S1 §8 and S5: enforce invariants mechanically. S5: feedback sensors beat instructions alone. | `.claude/rules/40-quality-gates.md:12` and `.claude/rules/70-testing.md` (tests/typecheck "must pass") with no PostToolUse or Stop hook in `.claude/settings.json:53-65`. Note `85-self-improvement.md:42` already says a mechanism beats a sentence, so the repo states the principle and does not apply it to its own gates. |
| Unrestricted Bash | S1 §7, S4: command allowlist, sandbox. | `.claude/settings.json:14`. |
| Instruction-heavy, inference-based gating (many agent reviews per task: reviewer, security, QA) before cheap computational checks | S5: computational sensors are cheap enough to run on every change. Inferential ones "not on every commit". S1: slow verification reduces iterations. | `.claude/rules/10-orchestration.md:44-52` (gate table: three LLM reviewers on T3). |
| Harness grows by rule-addition triggered by incidents with no removal trigger | S1 §10 and S4: strip what is no longer load-bearing. | `.claude/rules/85-self-improvement.md:34-39` (tiers add or tighten; "deleting an agent or skill" is Level C). |
| Hot-path ceremony on small work (amplifier pass on every prompt) | S1: "start simple". Not directly addressed by S3-S5. | `.claude/rules/80-prompt-amplifier.md`. The repo already scales it down for T0/T1 (`:30`). Weak support, treat as unverified against the sources. |

## 5. Changes that would bring the repo in line

Ordered by number of readable sources supporting (max 4). Tag: cheap = under about 1 hour, a few files; expensive = design work or new infrastructure.

| # | Change | Sources | Cost |
|---|--------|---------|------|
| 1 | Turn the self-improvement loop into a periodic "does this still pay" check: before keeping a rule/agent/skill, remove it and compare (add to `/retro` and `85-self-improvement.md`) | S1, S3, S4, S5 (via steering loop, which also covers pruning) | cheap |
| 2 | Add a `PostToolUse`/`Stop` hook that runs the project's scoped check from `CLAUDE.md` (and `node scripts/validate-harness.mjs` when `.claude/` files changed) | S1, S4, S5 | cheap |
| 3 | Make validator and hook messages carry remediation text for the agent ("fix: ...") | S1, S5 (S4 mentions lint hooks) | cheap |
| 4 | Cut always-loaded text: move per-tier or per-task policy out of auto-loaded rules into skills/`references/`, load on demand; add a hard budget check in the validator for rules + CLAUDE.md (currently only descriptions at `scripts/validate-harness.mjs:152`) | S1, S3, S4 | expensive (needs a rules audit; the budget check itself is cheap) |
| 5 | Session start: read recent `git log` and require a baseline check before new work (extend `.claude/hooks/session-start.mjs`; add a step 0 to `/build`) | S1, S4 | cheap |
| 6 | State a rule for context resets vs compaction and tool-output offloading (for downstream projects) | S1, S3, S4 | cheap (a paragraph) if kept short; do not grow rules if item 4 is pursued |
| 7 | Command allowlist and/or sandbox guidance in `.claude/templates/settings.harness.json` and `.claude/settings.json`; replace blanket `"Bash"` | S1, S4 | expensive (needs per-project tuning) |
| 8 | Recurring drift sensors (scheduled `@explorer` drift brief, validator run in CI) | S1, S5 | cheap for CI; expensive for scheduled agents |
| 9 | Grow `evals/agents/` to cover every agent, with calibrated criteria | S1, S5 (coverage of the harness itself) | expensive |
| 10 | Anti-placeholder instruction in `@developer`/`/build` | S1 only | cheap |
| 11 | Known-good git tags and a reset procedure | S1 only | cheap |
| 12 | Model routing beyond the static `model:` field | S3, S4 | expensive; low value for a rules-only repo |

## 6. Not a harness concern by these sources (candidates for removal or relocation)

By S4's definition prompts, tools and skills ARE harness. So "not harness" here means: belongs to the project's content or to the model, or is a convention outside what any source names. These are judgement calls from the source definitions, not proven redundancy.

- Role and etiquette that the model does natively: `.claude/rules/90-communication.md` (report formatting, "no filler") and parts of `.claude/rules/00-core.md:7-17` (prime directives like "finish the job", "never invent facts"). S4 and S1 §10 say model-capability assumptions go stale, and none of the sources lists tone as a harness primitive. This is prompt content that can be tested for removal.
- Generic engineering advice the model already knows: `.claude/rules/60-security.md` items 1-9 and `.claude/rules/70-testing.md` items 2 and 5. They are guides (C1), but S1 §10 and S5 prefer computational enforcement over restating practice. Keep only what is project-specific or enforceable.
- Vendored capability skills that restate model knowledge or other products' content (`coding-guidelines`, `security-best-practices`, `web-accessibility`, `mermaid-studio`, `the-jury`, `the-fool`, `the-judge`, design engines). None of the sources names domain-knowledge skills as a harness component beyond "skills as progressive disclosure" (S4). They are optional per project (`CLAUDE.md`: "Stack-specific skills… are added per project"), so moving them to `optional/` fits that stance. Weak evidence.
- Prompt amplifier (`.claude/rules/80-prompt-amplifier.md`): closest source support is S1's planner role ("expands a short prompt into a spec"), but that is a separate agent stage, not a rule on every prompt. No source supports it as a harness primitive. Treat as prompt content and a candidate for the S1 §10 ablation test. Changing it is Level C by `85-self-improvement.md:36`.
- Anything that is model-specific behaviour tuning (e.g. choice of `model: haiku/sonnet` in agent frontmatter): S3 and S4 call this model-harness coupling and it needs re-testing per model, so it is a harness concern but a fragile one.

Things that ARE clearly harness by the sources and should stay: `.claude/settings.json` (permissions, hook), `.claude/hooks/`, `scripts/` validators, task/state templates, agents' tool restrictions, handoff contract, incident loop.

## Gaps in this research
- S2 (Medium) not read. Any claim about it is absent on purpose.
- S3's year is not stated on the page.
- S1's date and authorship are not stated beyond the gist owner's handle.
- Conformance statuses are from reading the repo and running `node scripts/validate-harness.mjs`. No behavioural test of the agents was run.
