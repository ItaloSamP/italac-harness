# Task: Harness Hub MVP (Painel Visual + Multi-AI)

## Status: SHIPPED

Base: 4913003

## Problem

O harness atual opera apenas via linha de comando e arquivos Markdown, sem uma visão visual consolidada do backlog, das tarefas em execução, da agenda semanal, das issues/PRs do GitHub ou da paridade de regras entre Claude, Antigravity, Codex e Cursor.

## Acceptance criteria

- [x] Store de tarefas e máquina de estados Dual-Board (`Planejamento`: `planned`/`scheduled`/`to_fix` ↔ `Execução`: `queued`/`in_progress`/`in_review`/`ready`/`done` + `blocked`) mantêm `.specs/tasks/task-*.md` compatível com `scripts/validate-task.mjs` e locks atômicos `wx` impedem claim duplicado — evidence: `node --test hub/tests/store.test.mjs` (17 pass, 0 fail)
- [x] Gerador Multi-AI produz projeções determinísticas para Claude, Antigravity (`.gemini/rules/harness.md`), Codex (`.agents/rules/harness.md`) e Cursor (`.cursor/rules/harness.mdc`) contendo a regra de 4 passos de `80-prompt-amplifier.md` e detecta drift via SHA-256 — evidence: `node --test hub/tests/adapters.test.mjs` (8 pass, 0 fail)
- [x] Auto-Execute Runner dispara ao mover para `in_progress` com prompt de 4 partes, streaming SSE, `shell: false`, cancelamento e cliente GitHub REST API (issues atribuídas + PRs aguardando review + fallback demo) — evidence: `node --test hub/tests/runner.test.mjs` (13 pass, 0 fail)
- [x] Servidor HTTP/SSE (`127.0.0.1:7331`) e CLI (`scripts/hub.mjs`) integram S1–S3 com headers de segurança, proteção contra path traversal e fluxo E2E verificado ao vivo — evidence: `node --test hub/tests/server.test.mjs` (pass, 0 fail)
- [x] Frontend SPA Vanilla HTML/CSS/ESM em `hub/web/` implementa Mission Control, Kanban Dois Quadros + Unificado, criação inline estilo Trello, GitHub Inbox, Agenda Semanal, Agentes & Incidentes, Hub Multi-AI e Console ao Vivo com CSP estrita e escape XSS — evidence: `node --check hub/web/*.js` (exit 0) + verificação HTTP/SSE ao vivo
- [x] Integridade do harness preservada (`validate-harness.mjs` 0 erros dentro do orçamento de 33.000 B e `selftest.mjs` 0 falhas) — evidence: `node scripts/validate-harness.mjs` + `node evals/scripts/selftest.mjs`

## Out of scope

- Multi-repo / workspaces isolados em discos distintos (mapeado no Roadmap Fase 2).
- Chat conversacional multi-turno integrado e catálogo de MCPs (mapeado no Roadmap Fase 2).
- Execução automática de ações Level C (`git push`, abrir PR, deploy).

## Approach

Servidor local Node.js 24 native ESM sem dependências (`hub/server.mjs`), módulos de domínio em `hub/lib/`, CLI unificada em `scripts/hub.mjs`, sincronizador Multi-AI em `scripts/sync-adapters.mjs` e SPA Vanilla ESM em `hub/web/` seguindo `context/DESIGN.md` e `context/DECISIONS.md` (ADRs 001–006).

## Files

- `hub/lib/state-machine.mjs`
- `hub/lib/store.mjs`
- `hub/lib/adapters.mjs`
- `hub/lib/runner.mjs`
- `hub/lib/github.mjs`
- `hub/lib/sse.mjs`
- `hub/server.mjs`
- `hub/web/index.html`
- `hub/web/theme-init.js`
- `hub/web/styles.css`
- `hub/web/api.js`
- `hub/web/components.js`
- `hub/web/app.js`
- `scripts/hub.mjs`
- `scripts/sync-adapters.mjs`
- `hub/tests/store.test.mjs`
- `hub/tests/adapters.test.mjs`
- `hub/tests/runner.test.mjs`
- `hub/tests/server.test.mjs`

## Slices

| Slice | Files | Depends on |
|---|---|---|
| S1 | `hub/lib/store.mjs`, `hub/lib/state-machine.mjs`, `hub/tests/store.test.mjs` | – |
| S2 | `hub/lib/adapters.mjs`, `scripts/sync-adapters.mjs`, `hub/tests/adapters.test.mjs` | – |
| S3 | `hub/lib/runner.mjs`, `hub/lib/github.mjs`, `hub/lib/sse.mjs`, `hub/tests/runner.test.mjs` | – |
| S4 | `hub/server.mjs`, `scripts/hub.mjs`, `hub/tests/server.test.mjs` | S1, S2, S3 |
| S5 | `hub/web/index.html`, `hub/web/theme-init.js`, `hub/web/styles.css`, `hub/web/api.js`, `hub/web/components.js`, `hub/web/app.js` | – |

## Test scope

- `node --test hub/tests/*.test.mjs` (unit + integration + E2E HTTP/SSE/CLI)
- `node scripts/validate-harness.mjs` (0 errors, budget <= 33000 B)
- `node scripts/validate-task.mjs .specs/tasks/task-harness-hub-mvp.md` (0 errors)
- `node evals/scripts/selftest.mjs` (0 failed)

## Proof

`node --test hub/tests/*.test.mjs` (0 fail), `node scripts/validate-harness.mjs` (0 errors), `node scripts/validate-task.mjs .specs/tasks/task-harness-hub-mvp.md` (PASS), `node evals/scripts/selftest.mjs` (0 failed), `node scripts/sync-adapters.mjs --check` (exit 0), e revisão independente `@code-reviewer` + `@qa-engineer`.
