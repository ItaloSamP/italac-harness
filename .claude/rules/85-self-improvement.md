# 85 — Self-improvement (the harness fixes itself)

A defect in the output is fixed in the output. A defect in **how the team works** is fixed in the harness, so it cannot happen the same way twice. Treat the rules, agents and skills as code with bugs.

A harness incident is any of: the user corrects the process; a gate let something through; an agent misbehaved; routing failed; instructions are broken; a rule got in the way; the same help request keeps recurring. Not one: a bug in the project's code, or a project-specific pitfall. Those go to `/lessons-writer`.

## The loop

1. **Log it** at the moment it is noticed — one line, no analysis yet:
   `node scripts/incident.mjs add --key <stable-pattern-key> --layer <rule|agent|skill|brief|tool> --what "<what happened>" --where <file>`
   Reuse the key of an earlier incident of the same kind; the script counts recurrences.
2. Cause, fix, proof and closing: `/retro` steps 2–4.

Do both inside the current task when the cause is clear and the fix is small. Otherwise log (step 1), finish the user's task, then run `/retro`.

## Tiers

| Tier | What | Authority |
|------|------|-----------|
| **Fix now** | Broken or dangling reference; contradiction between two files; unclear or missing step in a pipeline skill; skill or agent description missing a trigger; handoff shape drift; a missing deterministic check | Level A — do it, report it in the final report |
| **Fix on recurrence** | A behavioural problem seen once with no clear cause in the harness (an agent had a bad run) | Log only. On the **second** occurrence of the same key, find the cause and fix |
| **Ask first** | Anything that loosens `30-autonomy.md` Level C, `50-git.md` gating or `60-security.md`; permissions or settings; deleting an agent or skill; changing `80-prompt-amplifier.md`; adding a hook | Level C — propose the exact diff, with the incident that motivates it |

## Guardrails

- **Evidence before rules.** A change needs a logged incident behind it. No rule is added for a hypothetical.
- The validator enforces a ceiling on always-loaded text: to add, cut.
- **Never self-approve a weakening.** A fix may make the harness stricter or clearer on its own authority; making it more permissive is the user's call.
- **Vendored engines are not edited** (design engines, third-party plugins). Record the workaround in our own skill instead.
- How to shape a fix, and porting a fix made in an installed copy upstream: `/retro` step 4.
