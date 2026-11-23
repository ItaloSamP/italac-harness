---
name: discovery
description: Requirements elicitation run by the Maestro in conversation with the user — extracts what is already known, decides everything a specialist can decide, asks the user-owned product questions in one batch with recommended defaults, then produces a PRD or feature requirement with testable acceptance criteria. Use at the start of a new product or large feature, when a request is too vague to plan ("quero criar um app de…", "tenho uma ideia", "I have an idea"), or when /blueprint finds the WHAT unclear. Do NOT use when scope is already clear (go to /blueprint) or for technical design (@tech-lead).
---

# Discovery — elicit once, assume the rest

Subagents cannot talk to the user, so elicitation happens **here, inline**. The goal is the fewest questions that remove the most uncertainty.

## Steps

### 1. Harvest before asking
Read everything already available: the prompt, earlier messages, existing `.specs/docs/`, the repo (if any), linked references. Write down what is **known**.

### 2. List the unknowns and classify each

| Class | Test | Action |
|-------|------|--------|
| **Assumable** | A competent PM would pick the obvious default | Decide it. Log under *Assumptions*. |
| **Researchable** | The answer exists outside the user's head (market, competitors, regulation, platform limits) | Dispatch `@researcher` now, in parallel with step 3 |
| **User-owned** | Only the user knows or may choose: who it is for, the core problem, what success means, hard constraints (deadline, budget, platform, compliance), what is explicitly out, taste and brand | Ask in step 3 |

### 3. One batch of questions
At most **5** questions, in a single message, most valuable first. Each has 2–4 concrete options with a recommended default, so the user can answer in seconds. Never ask what can be assumed. Never ask technical-design questions here.

Partial answer or "you decide" → take the recommended defaults and move on. No second round unless an answer opens a real product fork.

### 4. Write the requirement
- New product or large initiative → `@product-manager`, with a brief containing the known facts, the answers, the assumptions and the research → `.specs/docs/prd-<slug>.md` (it uses `/tlc-prd`).
- Single feature → `/feature-requirement` inline → `.specs/docs/feature-requirement-<slug>.md`.

Every document has: problem and user, success signals, main flow with its states (empty, error, permission, limits), **testable acceptance criteria**, explicit *Out of scope*, *Assumptions*, *Risks*.

### 5. Attack it once
Run `/the-fool` on the riskiest assumption (pre-mortem: "it shipped and nobody used it — why?"). Fold in what survives. If the doubt is cheap to test, recommend `/prototype` before building.

### 6. Confirm the cut (the one checkpoint)
Show the user a ten-line summary: who, problem, the v1 cut (in / out), success signal, top assumptions, and "preciso de você: <list>" (credentials, access, data, paid resources the work will need). This is user-owned — the product is theirs. After that, continue to the next phase with no further approval rounds.

## Output

```
Discovery: .specs/docs/<prd|feature-requirement>-<slug>.md
For: <user> · Problem: <one line>
v1 in: <list> · out: <list>
Success: <signal>
Assumed: <top 3>
Riskiest assumption: <…> → test via: <prototype | research | none needed>
Next: /prototype | @designer | @tech-lead | /blueprint
```
