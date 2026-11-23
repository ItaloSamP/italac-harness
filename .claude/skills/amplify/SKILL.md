---
name: amplify
description: Deepen a prompt with the four-question specialist pass (unasked expertise, rawest source, methods and tools, external proof) and rewrite it — without executing. Use when the user says "amplify", "improve this prompt", "potencialize", "melhore meu prompt", or wants to see the upgraded prompt before running it. The same pass runs automatically on every prompt via the prompt-amplifier rule; this skill is the explicit, stop-after-rewrite version.
---

# Amplify — a deeper task, not a bigger one

**Input:** `$ARGUMENTS` — the prompt to deepen.

## The pass

Identify the field the task belongs to, then answer as a top professional in that field:

1. **Unasked expertise** — what would they do here that the prompt does not ask for? (the step amateurs skip)
2. **Rawest material** — which primary source would they start from instead of something pre-digested? Look at what is actually available: the running code, real logs, the actual error, the schema, official docs for the installed version, real data.
3. **Methods and tools** — which specific, named techniques and tools would they use?
4. **External proof** — what, besides the assistant or the user, could prove the result is correct?

Ground the answers in the current project when there is one: check the repo for what really exists (test runner, CI, schema, logs) rather than naming generic tools.

## The rewrite

Rewrite the prompt so that it asks for exactly that:

- Same goal and same scope as the original — **no new features or deliverables**.
- Names the starting source (2), the method (3) and the acceptance proof (4).
- States what done looks like in checkable terms.
- Short: one to six sentences. Written in the user's language.

## Output

```
**Amplified brief**
1. Pro move: …
2. Raw source: …
3. Method/tools: …
4. Proof: …

**Rewritten prompt**
> …

Also worth doing (not included): <at most one line, or omit>
```

Then stop. Do not execute unless the user says to (in normal flow the rule `.claude/rules/80-prompt-amplifier.md` executes automatically).
