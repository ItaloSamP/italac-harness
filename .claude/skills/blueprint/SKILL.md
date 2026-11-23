---
name: blueprint
description: Plan a unit of work into a spec-driven task file under .specs/tasks/ — problem, testable acceptance criteria, approach, files, test triage, external oracle, and parallel slices for large work. Use for any T2/T3 feature or change before coding, or when the user says "plan", "blueprint", "spec this", "break this down". Proceeds to /build automatically unless a user-owned decision is open.
---

# Blueprint — plan to a task file

Produce a task file precise enough that a cold agent could build it without this conversation.

**Input:** `$ARGUMENTS` — description, issue number, or path to a doc in `.specs/docs/`.

## Steps

### 1. Understand the request
- Issue number → `gh issue view <n>`. Doc path → read it. Otherwise use the text.
- Reuse the amplified brief from this turn (`.claude/rules/80-prompt-amplifier.md`); do not redo it.

### 2. Read context — only what is relevant
`CLAUDE.md` project section · `context/GOTCHAS.md` · then by topic: `API.md`, `DATA_MODEL.md`, `FOLDER_ARCH.md`, `DECISIONS.md`, `DESIGN.md`.
No `context/` and the repo has code → follow the "No `context/`" line of `.claude/rules/75-context-docs.md`.

### 3. Investigate minimally
Read the files that will change. Scope unclear or wider than ~6 files → dispatch `@explorer` with the exact question and consume its map.

### 4. Escalate before planning, if needed (no user question)
| If | Then |
|----|------|
| WHAT is unclear (who, which behaviour, scope) | `/discovery` → plan from its doc |
| Bigger than a handful of task files, or a new product | Stop planning here → `/kickoff` |
| HOW has real alternatives, touches architecture/data model/public contract, or spans modules | `@tech-lead` → plan from its spec and slices |
| Unknown library/API behaviour | `@researcher` |
| New trust boundary or external integration | `/security-threat-model` |

### 5. Write the task file
Copy `.claude/templates/task.md` → `.specs/tasks/task-<slug>.md` and fill every section.
- **Acceptance criteria** are behaviours a test or a manual check can verify.
- **Approach** names files and changes concretely.
- **Proof** names at least one external oracle; if none exists, add "create it" as an AC.
- **Slices (T3):** independent vertical slices with disjoint file scopes; mark dependencies. One slice = one `@developer`.
- **Decisions taken:** every choice you made that a reader might question, with the reason.
- **Contract changes:** every surface whose contract changes (endpoint, table, schema or grain, schedule, model input/output, CLI flag, public type).
- **Kind:** read the project's kind row in `.claude/skills/build/references/verification.md` — what the requirement must answer, the proof, what delivered means, what is needed from the user.
- **Needs from user:** Level C only (`.claude/rules/30-autonomy.md`): decisions, credentials, access, paid resources.

### 6. Self-check the plan
First the mechanical check — fix every error it prints:

```bash
node scripts/validate-task.mjs .specs/tasks/task-<slug>.md
```

Then judgment:
- Could a cold agent build this without asking anything?
- Is each AC verifiable? Is anything in scope that the user did not ask for?
- Contradicts `context/DECISIONS.md`? → fix or supersede explicitly.
- High-risk plan (data migration, auth, money, irreversible) → run `/the-fool` on it and fold in what survives.

### 7. Continue
- **`## Needs from user` empty →** print the summary below and go straight to `/build <task-file>`.
- **Not empty →** ask everything in `## Needs from user` in one message (with recommendations), and build everything that does not depend on it.
- User asked only for a plan → stop here.

## Output

```
Blueprint: .specs/tasks/task-<slug>.md  (T2 | T3 — <n> slices)
ACs: <n> · Files: <n> · Contracts: <n>
Proof: <oracle>
Decisions taken: <list>
→ building now | waiting on: <needs from user>
```
