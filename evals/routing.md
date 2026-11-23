# Routing eval

Does the constitution route a raw user prompt to the right first step? 14 prompts, each with the route `.claude/rules/10-orchestration.md` should produce.

## How to run

Dispatch `@tech-lead` READ-ONLY (model `inherit`, so it runs on the Maestro's model and loads the same rules) with the 14 prompts below and this instruction:

> For each prompt, name the tier and the first skill or agent the rules in your context prescribe; use no tools.

Score each answer against "Expected first route" and add one dated row to the results table. Re-run after any change to the triage table, the routes or a skill/agent description.

## Cases

IDs `R11` and `R12` are the two cases the decision record (`.specs/docs/adr-harness-v2-decisions.md`, WO-0) names; they are expected to fail on the baseline.

| ID | Prompt | Expected first route | A wrong answer looks like |
|----|--------|----------------------|---------------------------|
| 01 | "adiciona login com Google" | `/blueprint` (T2) | |
| 02 | "tá quebrando ao salvar o perfil" | `/bugfix` | |
| 03 | "produção caiu" | `/hotfix` | |
| 04 | "quero ver como ficaria um dashboard assim" | `/prototype` | |
| 05 | "quero criar um app mobile de X" | `/kickoff` | |
| 06 | "cria a tela de configurações" | `/design` | |
| 07 | "o CI tá vermelho" | `@devops` | |
| 08 | "qual banco usar?" | `@tech-lead` | |
| 09 | "documenta esse módulo" | `@tech-writer` | |
| 10 | "troca o texto do botão para Salvar" | T1 inline | |
| 11 | "o que essa função faz?" | T0 answer inline | |
| 12 | "você esqueceu de rodar os testes de novo" | log incident (`node scripts/incident.mjs add`) | |
| R11 | "cria um pipeline que puxa a API X para o BigQuery todo dia" | `/blueprint` or `/kickoff` | `@devops` |
| R12 | "por que as vendas caíram em março? os dados estão em vendas.csv" | T2 with the analysis kind | a T0 opinion |

## Results

One row per run. Cell = `ok`, or `FAIL: <what was answered>`.

| Date | Run | Model | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 | R11 | R12 | Score |
|------|-----|-------|----|----|----|----|----|----|----|----|----|----|----|----|-----|-----|-------|
| 2026-11-11 | baseline (before WO-2 cuts) | inherit, cold `@tech-lead`, no tools | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ UNCLEAR: T3 vs `/kickoff` (`@devops` plausible) | ✘ UNCLEAR: T0 vs `@researcher` | 12/14 |
| 2026-11-11 | after WO-2 cuts — **INVALID, see note** | inherit, cold `@tech-lead`, no tools | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ UNCLEAR: T2 vs T3 (no longer names `@devops`) | ✘ UNCLEAR: T0 vs no route | 12/14 — no regression; extra probe "quero criar um novo agente" → `/agent-creator` ✔ |

| 2026-11-11 | after WO-9 + Q1/Q4/Q5 — **INVALID, see note** | inherit, cold `@tech-lead`, no tools | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ | not counted |

## Note — an in-session run measures a stale snapshot

Found 2026-11-11: a subagent dispatched in a running session receives `CLAUDE.md` and the rules **as they were when that session started or resumed**, not as they are on disk. The last run above answered from rule text that had already been replaced (it described local merge as gated and found no analysis route, while `10-orchestration.md` and `50-git.md` on disk said otherwise). Therefore the two rows marked INVALID prove nothing about the edited rules.

**Procedure:** after editing `CLAUDE.md` or any rule, open a NEW session and run the eval there. Record the session as fresh in the Run column. Pending: one fresh-session run against the current rules (expected: R11 and R12 pass, the other 12 match the baseline).
