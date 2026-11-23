---
name: prototype
description: Build a fast, throwaway prototype or spike to answer a question. Use when the user says "how would this look", "does this approach work", "try X", "mock this screen", "proof of concept", "spike". Optimises for speed and learning - mocked data, no task file, no tests, no review. Ends with what was learned and a recommendation to discard or promote into the real pipeline.
---

# Prototype — learn fast, throw away freely

A prototype answers **one question**. State it before building.

## Rules

1. **Isolated:** everything lives under `prototypes/<slug>/` (or a scratch branch `proto/<slug>` when it must touch the app). Never mixed into product code paths.
2. **Skipped on purpose:** task file, tests, audit, context docs, commits. Mock data and hardcode freely.
3. **Still forbidden:** real secrets, real user data, outward actions, anything destructive.
4. **Time-box:** the smallest thing that answers the question. If it grows past a few files, it is a feature → `/blueprint`.
5. **It must run.** Open it, click it, call it. A prototype nobody ran proves nothing.

## Kinds

| Question | Approach |
|----------|----------|
| How should it look / feel? | `@designer` in prototype mode, or inline `/design` steps 1–3 and 5 (engine + system, no spec, floor gate only) — single HTML file or the project's stack; 2–3 variants when direction is open |
| Does this technical approach work? | Spike script exercising the risky part only; measure the thing in doubt |
| Which library/service? | `@researcher` for candidates → tiny spike of the top 1–2 |
| What does the flow feel like end to end? | Clickable mock with fake data |

## Steps

1. Write the question and the success signal (one line each).
2. Build the minimum. Run it. Capture evidence (screenshot via `/playwright-skill`, output, numbers) under `prototypes/<slug>/`.
3. Write `prototypes/<slug>/NOTES.md`: question · what was built · what was learned · what was faked · recommendation.
4. Recommend: **discard**, **iterate** (what to change), or **promote** → `/blueprint` using the notes as source. Promotion means rebuilding properly, not merging the prototype.

## Output

```
Prototype: prototypes/<slug>/
Question: <…>
Answer: <what we learned> — evidence: <path>
Faked: <list>
Recommendation: discard | iterate | promote → /blueprint
```
