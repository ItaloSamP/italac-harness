# 20 — Delegation, handoff and asking for help

## Hard facts about the runtime

- Subagents **cannot spawn subagents**. All delegation flows through the Maestro.
- A subagent sees **only its brief** — not the conversation. A weak brief produces weak work.
- Therefore agents "call each other" by **returning a `NEEDS` line**; the Maestro dispatches it immediately, without asking the user.

## The brief (Maestro → agent)

Every dispatch contains, in this order:

```
GOAL: <outcome in one sentence — what must be true at the end>
CONTEXT: <task file path, relevant context/*.md, what was already tried/decided>
SCOPE: <files/dirs you may touch> | READ-ONLY
OUT OF SCOPE: <what not to do>
DONE WHEN: <checkable criteria>
RETURN: your Output shape + handoff block (below); long material goes to a file
```

Prefer pointing at files (`.specs/tasks/task-x.md`) over pasting content. Never send "based on the above" — there is no above.

## The handoff (agent → Maestro)

Every agent ends with this block. The `STATUS` vocabulary is fixed; a field that does not apply may be omitted:

```
## Handoff
STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_HELP | BLOCKED
SUMMARY: <what is now true, 1-3 lines>
EVIDENCE: <commands run → result; or "none (read-only)">
FILES: <created/changed/written paths>
DECISIONS: <choices made and why, one line each>
CONCERNS: <risks, things not verified>
NEEDS: @<agent> — <exact ask>          (zero or more lines)
USER-DECISION: <question>               (only if it is truly user-owned)
```

Long output (reports, maps, reviews) is written to `.specs/docs/` or `.specs/logs/` and referenced in `FILES` — not pasted.

## Maestro reaction table

| Returned | Maestro does |
|----------|--------------|
| `DONE` | Verify the evidence cheaply (file exists, test command re-run if it gates a commit), continue the route |
| `DONE_WITH_CONCERNS` | Resolve each concern (inline or dispatch) or record it in the task file as accepted risk |
| `NEEDS_HELP` + `NEEDS` | Dispatch the named agent with a full brief, then resume the original agent with the answer |
| `BLOCKED` | Try one alternative route; only then surface to the user with what was tried |
| `USER-DECISION` | Check `30-autonomy.md`: if not truly user-owned, decide and continue; else ask once, with a recommendation |

A handoff is a report, not proof. Never relay "tests pass" to the user without the command output behind it.

## When an agent MUST ask for help (no heroics)

| Situation | Bring in |
|-----------|----------|
| Same failure after **2** fix attempts | `@debugger` |
| Need to understand code outside your scope / "where is X" across the repo | `@explorer` |
| Unknown library/API behaviour, version-specific docs, error not explained by the code | `@researcher` |
| Change would alter architecture, a public contract or the data model beyond the task file | `@tech-lead` |
| Requirement is ambiguous in a way that changes what gets built | `@product-manager` |
| Touching a sensitive surface without a security note in the task file | `@security-auditor` |
| UI with no design reference and visual quality matters | `@designer` |
| Tests needed for code you did not write / flaky suite / browser verification | `@qa-engineer` |
| Build, CI, env, container, deploy problems | `@devops` |
| LLM feature: prompts, tool design, evals, model choice | `@ai-engineer` |
| Docs or context files need more than a few lines of update | `@tech-writer` |

Spinning (retrying the same idea, widening scope to hide a failure, disabling a test) is a rule violation. Stop and return `NEEDS_HELP`.

## Parallel work

Fan out only when slices are independent: no shared files, no slice needs another's result. Each parallel `@developer` gets its slice ID and an explicit file scope; the Maestro is the only writer of the task file. Send all dispatches in one message. After they return, the Maestro integrates and runs the combined checks — parallel agents never verify each other's slices.

Two writers never touch the same file. If slices collide, run them in sequence.

**Hot files stay with the Maestro.** Manifests and lockfiles (`package.json`, `pyproject.toml`…), route/module registries and barrel indexes, shared config, migration sequences and shared types are edited only during integration. A developer who needs one returns the exact change under `INTEGRATION:` in its handoff.

**Limits.** At most 4 agents in flight. Parallel developers run only their own scoped unit tests — anything needing a shared port, database or build output waits for integration.

## When an agent fails

No handoff block, an empty answer, obvious fabrication, or a timeout: re-dispatch **once** with a tighter brief (smaller scope, explicit DONE WHEN, the missing context). Second failure → do it inline or route to a different agent, and note it in the task file log. Every such failure is logged as an incident (`85-self-improvement.md`); the second one with the same key is a harness defect → fix the agent (`/agent-creator` steps 6–8) or the brief that feeds it.
