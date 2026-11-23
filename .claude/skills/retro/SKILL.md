---
name: retro
description: Retrospective that improves the harness itself — gathers evidence of what went wrong in how the team worked (user corrections, review rounds, failed handoffs, gates that missed, open incidents), traces each to the rule, agent or skill that allowed it, applies the fix, proves it with the validator and agent evals, and logs it. Use after a delivery that needed more than one fix round, when the session start lists open incidents, or when the user says "retro", "o que deu errado", "melhora o workflow", "why did that happen", "auto-improve". Do NOT use for project code lessons (use lessons-writer) or to create a new agent from scratch (use agent-creator).
---

# Retro — fix the system, not the symptom

Policy: `.claude/rules/85-self-improvement.md`. This skill is the batch version of its loop.

## Step 1 — Gather evidence (raw, not remembered)

- `node scripts/incident.mjs open` — logged incidents and their recurrence counts.
- Task files touched since the last retro: the `## Log` sections (review rounds, deviations, `BLOCKED` periods), acceptance criteria that failed QA.
- Handoffs that came back `NEEDS_HELP`, `BLOCKED`, malformed or with unverified claims.
- The conversation: every place the user corrected, repeated themselves or overrode a decision.
- `git log` on `.claude/` since the last retro — what was already changed, so nothing is fixed twice.

Log anything found that is not yet in the incident file (`incident.mjs add`). The seven signals of rule 85, with examples:

| Signal | Example |
|--------|---------|
| The user corrects the process | "you should have tested that", "stop asking me this", "wrong agent for that" |
| A gate let something through | A bug found after `/audit` approved; a UI shipped without its states |
| An agent misbehaved | No handoff block, fabricated evidence, left its scope, spun on a failure |
| Routing failed | The wrong skill fired, or none did when one clearly applied |
| Instructions are broken | A reference to a skill, agent or file that does not exist; two files that contradict each other |
| A rule got in the way | Following it produced a worse result, or it was skipped because it was impractical |
| The same help request keeps recurring | Developers repeatedly need the same missing context |

## Step 2 — Trace each incident to a layer

Ask "what in the harness made this the easy path?" and name the file.

| Layer | Typical cause | Typical fix |
|-------|---------------|-------------|
| **Rule** | Missing, ambiguous or contradictory policy | Tighten the line; add the reason |
| **Agent** | Vague stance, missing hard rule, too many tools, wrong model | Edit the agent file (method: `/agent-creator` steps 6–8); re-run its eval |
| **Skill** | Missing step, wrong order, weak description so it never fires | Edit the step; rewrite the description with real trigger phrases |
| **Brief** | The Maestro's dispatch lacked scope, context or DONE WHEN | Fix the brief contract or the skill that builds the brief |
| **Tool / check** | Nothing mechanical catches the defect | Add a check to `scripts/validate-harness.mjs` or `scripts/validate-task.mjs` |
| **None** | One bad run, no structural cause | Leave logged; act on recurrence |

Several incidents with one cause are one fix.

## Step 3 — Decide by tier

Apply the tiers of rule 85. Fix-now items: do them. Recurrence items below the threshold: leave open. Ask-first items: collect them into **one** question for the user, each with its incident and the exact proposed change.

## Step 4 — Fix and prove

For each fix:

1. Make the smallest change at the cause, in the harness and not in the moment: which rule, agent file, skill step or brief shape allowed this?
2. `node scripts/validate-harness.mjs` → PASS.
3. Agent changed → re-run its scenarios in `evals/agents/<name>.md`. None exists → first write one scenario that reproduces the incident (`/agent-creator` step 8), see it fail, then fix.
4. `node scripts/incident.mjs fix --key <key> --fix "<file — what changed>"`.
5. One line in `CHANGELOG.md`: date, incident key, change.

A fix that cannot be proven is reported as unproven, with what would prove it.

How to shape a fix:

- **Smallest change at the cause.** Prefer tightening or replacing an existing line over adding a new one. Prefer removing a tool or adding a validator check over adding prose — a mechanism prevents, a sentence only discourages. Where a deterministic check can catch the class of defect, add it to the validator instead of adding prose.
- **One source of truth.** Fix the rule; do not patch the symptom in three skills.
- **Every rule carries its reason** when the reason is not obvious, so later sessions can judge edge cases instead of following it blindly.
- **Where fixes live.** In the harness repository the fix is final. In a project that *installed* the harness, the fix lands in that project's copy and the incident is marked `upstream: pending`: port it to the harness repository before the next install, which refuses to overwrite pending fixes without `--force`.

## Step 5 — Check for bloat

Compare the validator's token estimate before and after. A change that grows it must be worth it; a retro that only adds text is suspect. If it grew, look once for something this retro made redundant and remove it.

## Output

```
Retro: <n> incidents reviewed — <n> fixed · <n> left open (first occurrence) · <n> need your decision
Fixed:
- <key> (×<count>) — <layer> — <file>: <change> — proof: <validator | eval result>
Open:
- <key> — <why no structural cause yet>
Your decision:
- <key> — <proposed change> — because <incident>
Budget: <before> → <after> tokens
```
