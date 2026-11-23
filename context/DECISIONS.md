# Decisões Arquiteturais (ADRs) — Harness Hub

Registro das decisões técnicas estruturais do projeto. Cada ADR compara 2–3 opções reais, explicita trade-offs e justifica a escolha adotada.

---

## ADR-001: Runtime do Servidor e Stack do Frontend

- **Data:** 2026-11-23
- **Status:** Aceita
- **Contexto:** O Harness Hub precisa rodar localmente com um único comando em Windows nativo (ambiente principal do usuário), macOS e Linux, ser empacotável pelos instaladores (`install.ps1` / `install.sh`) e manter manutenção simples sem quebrar o harness.
- **Opções consideradas:**
  1. **Node.js 24 ESM nativo (zero dependências npm) + SPA Vanilla HTML/CSS/ESM sem build step** *(escolhida)*: usa apenas `node:http`, `node:fs`, `node:child_process`, `node:crypto` e `node:test`. Reutiliza o runtime já exigido pelos scripts do harness (`scripts/*.mjs`).
  2. **Python 3 stdlib (`ThreadingHTTPServer`) como o `devworks-harness`**: zero deps em Python, mas introduz um segundo runtime obrigatório e a referência usa chamadas POSIX (`ps`, `SIGKILL`, `bash`) que falham em Windows nativo.
  3. **Vite + React + Express/Fastify**: produtividade inicial de UI, mas adiciona `node_modules`, etapa de build, lockfiles, risco de drift de dependências e complica a cópia direta pelos instaladores do harness.
- **Decisão:** Adotar **Node.js >= 24 ESM nativo com zero dependências em runtime** no backend (`hub/server.mjs`, `hub/lib/*.mjs`) e **Vanilla HTML/CSS/ESM** sem build step em `hub/web/`.
- **Consequências:** Inicialização instantânea (`node scripts/hub.mjs serve`), 100% portável entre Windows/macOS/Linux, zero vulnerabilidades transitivas de `npm`. Exige disciplina na modularização da UI (`api.js`, `components.js`, `app.js`) em vez de depender de framework.

---

## ADR-002: Persistência Dual (Markdown Canônico + `board.json`)

- **Data:** 2026-11-23
- **Status:** Aceita
- **Contexto:** Os arquivos `.specs/tasks/task-*.md` são a fonte única de verdade lida pelos agentes e validada por `scripts/validate-task.mjs`. Porém, o Hub precisa persistir metadados operacionais (prioridade P0–P3, agente responsável, revisor, aprovações, agendamento semanal, vínculo com GitHub Issue, ordem manual e configuração do runner).
- **Opções consideradas:**
  1. **Markdown canônico (`.specs/tasks/*.md`) para ciclo de vida + `.specs/hub/board.json` para metadados de planejamento** *(escolhida)*: mantém `.specs/tasks/*.md` 100% compatível com `validate-task.mjs` e legível para humanos/agentes; `board.json` é leve, versionável e gravado atomicamente (`tmp + rename`).
  2. **Frontmatter YAML dentro de cada `.specs/tasks/*.md`**: centraliza tudo num arquivo, mas altera o formato esperado pelos templates do harness e exige reescrever arquivos Markdown a cada reordenação de drag & drop ou mudança de agenda.
  3. **SQLite local (`node:sqlite`)**: bom para queries complexas, mas cria arquivo binário não versionável em git e introduz risco de dessincronização com edições feitas na IDE.
- **Decisão:** Manter `.specs/tasks/*.md` como fonte única de verdade de status/conteúdo/ACs/log e armazenar metadados de planejamento do Hub em `.specs/hub/board.json`.
- **Consequências:** `validate-task.mjs` passa sem alterações; edições de prioridade/agenda não sujam o diff do task file. O `store.mjs` faz reconciliação automática caso um arquivo de tarefa seja criado ou removido fora do Hub.

---

## ADR-003: Protocolo de Lock Atômico e Concorrência Segura

- **Data:** 2026-11-23
- **Status:** Aceita
- **Contexto:** Múltiplos agentes (em diferentes IAs ou via Auto-Execute Runner) podem tentar reivindicar a mesma tarefa simultaneamente (`AC-10.3`), e dois escritores nunca podem editar o mesmo arquivo (`RN-05`).
- **Opções consideradas:**
  1. **Arquivos de lock atômicos por tarefa via `fs.openSync(path, 'wx')` em `.specs/hub/locks/<taskId>.lock` + checagem de sobreposição de `## Files`** *(escolhida)*: `O_CREAT | O_EXCL` é garantidamente atômico no kernel tanto em NTFS (Windows) quanto em ext4/APFS (POSIX), funciona entre processos independentes (CLI e servidor HTTP) e permite execução paralela de tarefas com arquivos disjuntos.
  2. **Lock apenas em memória no processo do servidor HTTP**: falha se um agente executar `node scripts/hub.mjs claim` via CLI enquanto outro usa o Hub ou se houver duas chamadas CLI concorrentes.
  3. **Lock global único do repositório (como `.ralph.lock` no `devworks-harness`)**: impede paralelismo legítimo entre slices com arquivos disjuntos (ex.: `@developer` e `@designer` trabalhando em paralelo).
- **Decisão:** Adotar lockfiles atômicos por `taskId` via `openSync(..., 'wx')` em `.specs/hub/locks/`, combinados com validação de interseção de `## Files` contra tarefas ativas em `IN_PROGRESS` e limite configurável `maxConcurrentRuns`.
- **Consequências:** Garante exatamente 1 vencedor sob contenção real entre processos, sem dependências nativas. Inclui limpeza segura de locks órfãos quando o PID de um runner local não existe mais.

---

## ADR-004: Atualização em Tempo Real via SSE + `fs.watch`

- **Data:** 2026-11-23
- **Status:** Aceita
- **Contexto:** Edições externas nos arquivos do repositório devem aparecer no Hub em ≤ 5 s (`AC-16.1`), e o Auto-Execute Runner precisa transmitir progresso e logs linha a linha ao vivo para a UI.
- **Opções consideradas:**
  1. **Server-Sent Events (`GET /api/events`) + `fs.watch` com debounce de 250ms** *(escolhida)*: nativo em `node:http` e no navegador (`EventSource`), unidirecional (servidor → cliente) ideal para notificações e streaming de logs, com reconexão automática e heartbeat de 15s.
  2. **Polling HTTP a cada 1 segundo (como `devworks-harness`)**: simples, mas gera tráfego ocioso constante (3+ reqs/s), maior latência percebida nos logs ao vivo e mais trabalho de diff no cliente.
  3. **WebSocket**: bidirecional desnecessário para mutações que já são REST bem definidas; exigiria implementação manual do protocolo RFC 6455 sem dependências externas.
- **Decisão:** Usar **SSE (`text/event-stream`)** via `hub/lib/sse.mjs` alimentado por `fs.watch` (com fallback de detecção de erro emitindo `watcher:error` para o banner `Desconectado dos arquivos`) e pelos eventos do `runner.mjs`.
- **Consequências:** Zero dependências, latência sub-segundo para logs e mudanças no filesystem, e contrato trivial de consumir em `hub/web/api.js`.

---

## ADR-005: Auto-Execute Runner e Integração com GitHub Issues

- **Data:** 2026-11-23
- **Status:** Aceita
- **Contexto:** O usuário quer arrastar uma tarefa para `IN_PROGRESS` e vê-la executar automaticamente (com logs ao vivo e prompt amplificado de 4 partes de `80-prompt-amplifier.md`), além de puxar issues atribuídas no GitHub diretamente para o backlog — tudo de forma segura e testável imediatamente mesmo sem chaves externas configuradas.
- **Opções consideradas:**
  1. **Runner desacoplado com `spawn(..., { shell: false })`, engine `mock` embutida e GitHub REST API com credencial somente em memória (`GITHUB_TOKEN` ou `gh auth token`) + modo demo offline** *(escolhida)*: permite testar todo o fluxo ponta-a-ponta imediatamente com `mock`, elimina risco de shell injection, nunca persiste tokens em disco e mantém compatibilidade com as 4 CLIs reais (`claude`, `codex`, `cursor`, `antigravity`).
  2. **Somente fila pull manual (sem runner no Hub)**: exige intervenção manual em terminais separados para cada tarefa, frustrando a experiência interativa de arrastar para `IN_PROGRESS`.
  3. **Execução via `shell: true` e token salvo em `board.json`**: alto risco de injeção de comando via títulos/corpos de issues externas e vazamento de segredos no git (viola `RN-09` e regra #5 de `AGENTS.md`).
- **Decisão:** Implementar `hub/lib/runner.mjs` com `shell: false`, prompt builder de 4 partes (`80-prompt-amplifier.md`), engine `mock` padrão para testes imediatos, stop cross-platform (`taskkill /T /F` no Windows / process group kill no POSIX), e `hub/lib/github.mjs` usando `fetch` nativo com token efêmero em memória e fallback gracioso para modo `demo`.
- **Consequências:** Fluxo interativo completo desde o primeiro minuto; ações Level C (push, PR, deploy) permanecem estritamente bloqueadas no runner e na UI.

---

## ADR-006: Projeções Multi-AI Canônicas e Detecção de Drift

- **Data:** 2026-11-23
- **Status:** Aceita
- **Contexto:** As regras vivem canonicamente em `.claude/rules/` (consumidas nativamente pelo Claude Code), mas Antigravity, Codex e Cursor leem arquivos em caminhos distintos. O orçamento sempre carregado de `.claude/rules/` está em `32968 / 33000 B` (32 bytes livres).
- **Opções consideradas:**
  1. **Gerador determinístico (`hub/lib/adapters.mjs` + `scripts/sync-adapters.mjs`) projetando da fonte canônica para `.gemini/rules/harness.md`, `.agents/rules/harness.md` e `.cursor/rules/harness.mdc` com manifesto SHA-256** *(escolhida)*: zero bytes adicionados em `.claude/rules/`, inclui explicitamente `80-prompt-amplifier.md` em todas as projeções, detecta tanto drift canônico quanto edição manual na projeção (exigindo confirmação Level C), e é 100% portável no Windows.
  2. **Symlinks apontando para `.claude/rules/`**: falha frequentemente no Windows sem privilégios de Administrador/Developer Mode e não resolve formatos diferentes (ex.: frontmatter `.mdc` do Cursor).
  3. **Manter cópias manuais por ferramenta**: inevitavelmente gera drift silencioso entre IAs.
- **Decisão:** Adotar projeções geradas deterministicamente com verificação SHA-256 em `.specs/hub/adapters-manifest.json` e validação automática via `scripts/validate-harness.mjs` após cada sincronização.
- **Consequências:** Paridade 4/4 verificável e idempotente sem tocar no orçamento de contexto do Claude Code.
