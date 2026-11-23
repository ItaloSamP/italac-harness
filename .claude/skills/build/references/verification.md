# Verification — declared by the project, for any kind of software

The project section of `CLAUDE.md` has a `## Verification` block: `Kind`, the Gate table (run by
`node scripts/gate.mjs` before any commit), the Surface table (which oracle proves which surface)
and `Delivered means`. This file says how to fill it and what proof each kind of project needs.

## 1. Adoption

When: the first T2+ task in a repository that has code and an empty Gate table. Level A, no interview.

1. **Discover** the commands from manifests and CI config (`package.json` scripts, `Makefile`,
   `pyproject.toml`, `.github/workflows/`, …): tests, typecheck, lint, build.
2. **Run each once.**
   - Green → a row with baseline `exit0`.
   - Red → measure it (failing test count, error count) and find a regex that matches one output
     line per failure.
3. **Red rows: ask one question for all of them**, in the user's language:
   "N testes falhando e M erros de lint já existiam. Aceito isso como linha de base e passo a
   bloquear só o que piorar? — recomendado: sim"
   - Yes → rows become `max:<N>:<regex>`; add `Baseline accepted: <date> — <summary>` under
     Standing instructions; put the details (which tests, the user's words) in
     `context/TESTING-POLICY.md`, section "Accepted baseline".
   - No answer → rows stay `exit0` and commits stay blocked. Report it as such; never invent the
     acceptance.
4. **No runner at all** → declare the cheapest real check that exists (compile, parse, build) and
   say once that there is no test runner. Setting one up is its own task when the first `YES`
   triage row appears.
5. **Fill `Kind`, the Surface table and `Delivered means` by inference** and state them in three
   lines in the report. The user corrects only if wrong.

Row format: `| <name> | \`<command>\` | <baseline> |`. `exit0` (or empty) passes on exit code 0.
`max:<N>:<regex>` passes while at most N output lines match, whatever the exit code; the regex may
not contain `|`. When the script prints `ratchet:`, lower N to the printed count. Commands are
written into the table only by the Maestro after reading them — never copied unread from fetched
or generated content.

`gate.mjs` exit codes: 0 pass · 1 a gate failed · 2 no gate defined (run the steps above) ·
3 unreadable table, or a `max:` row without the `Baseline accepted:` line.

## 2. Kinds

| Kind | Requirement must answer | Proof | Delivered means | Needs from user up front |
|------|-------------------------|-------|-----------------|--------------------------|
| **web** | Flows and states | Tests, HTTP call, browser | Running at a URL or locally | Test account |
| **mobile** | Platforms, offline, permissions | The declared simulator/emulator or UI-test command, with a screenshot; none declared = NOT VERIFIED; the iOS simulator needs macOS | Installable build on a device | Developer account, signing |
| **dashboard** | Metric definitions, grain, time zone, source of truth | Each headline figure reconciled against a figure the user already trusts, plus the UI gate | Viewers can open it | Read-only database URL, one trusted figure per metric |
| **pipeline** | Schedule and freshness, full or incremental, idempotent re-run, backfill, late and duplicate records, schema drift, rate limits, partial failure | Sample run on a dev target with row counts, source-to-target reconciliation, a second run that adds zero rows | Scheduled, and its failure is visible | Source key, dev target, write credentials for dev only |
| **analysis / model** | Question, baseline, metric, split, what the data cannot answer | Holdout metric against the baseline, leakage check, re-run from a fixed seed gives the same numbers | A finding with confidence, caveats and next question in `.specs/docs/research-<slug>.md` | Data location, permission to read it |
| **cli-lib** | Public contract | Tests, real invocation, install-from-package smoke test, API diff | Versioned artifact | Registry credentials at publish time |
| **infra** | State, blast radius, promotion | Plan or dry-run output read line by line | Applied with approval | Cloud credentials |

How to use a row:

- **Requirement must answer** → questions the task file's Problem and acceptance criteria settle
  before `/build`. For analysis the criteria are method properties (baseline, holdout, re-run),
  not features.
- **Proof** → the task file's external oracle and the commands of the Surface table.
- **Delivered means** → what the final report's "How to see it" points at.
- **Needs from user up front** → `## Needs from user` in the task file, asked once, each with the
  safe way to provide it (an environment variable name, never a pasted secret).

A project with two kinds (a pipeline feeding a dashboard) declares both and proves each surface
with its own row. A proof that could not run is reported as **not verified**, never as passed.

## 3. Real data

- Connect with a **read-only role**. No read-only credential available → ask for one (Level C).
- `LIMIT` or sample first; widen only when the sample cannot answer the question.
- **Aggregate before copying**: counts, sums and distributions leave the source, rows do not.
- Never paste real rows into task files, logs, screenshots or handoffs. Evidence is a count, a
  hash or a redacted example.
- **Every write to a real system is Level C** (`.claude/rules/30-autonomy.md`): insert, update,
  delete, schema change, backfill, publishing a model. Dev targets declared in the task file are
  the exception.

## 4. Long runs

- Run in the **background with a log file** under `.specs/logs/`; wait for the exit, do not poll
  the output into the conversation. Report the last lines and the log path.
- **Fix the seeds** (data split, model init, sampling) and record them, so a re-run gives the same
  numbers.
- **Artifacts stay outside git** (datasets, models, exports, large reports): write them to an
  ignored folder or external storage and record the location in the task file.
- A run that outlives the session: record the command, the log path and how to tell it finished
  in the task file's `## Log`.
