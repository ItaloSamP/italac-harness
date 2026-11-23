# Pesquisa Comparativa: `ArthurDevWorks/devworks-harness` vs. Nosso Harness (`workflow`)

**Data:** 2026-11-23  
**Autor:** `@researcher`  
**Fontes primárias inspecionadas:**
- Repositório de referência (`devworks-harness`): `scripts/dashboard/server.py`, `scripts/dashboard/web/{index.html,app.js,app.css}`, `tests/test_dashboard.py`, `scripts/engines/{antigravity,claude,codex,opencode}.sh`, `docs/agents/{canonical-workflows,antigravity,claude,codex,opencode}.md`, `config/{harness.json,model-policy.tsv}`, `scripts/{ralph.sh,ralph-web.sh,install-platform.sh}`, `README.pt-BR.md`.
- Nosso repositório (`C:\Estudos\workflow`): `CLAUDE.md`, `AGENTS.md`, `.claude/rules/10-orchestration.md`, `scripts/{validate-harness.mjs,validate-task.mjs,gate.mjs}`.
- Documentação externa verificada: Cursor CLI headless (`agent -p`) e convenções `.cursor/rules/*.mdc`, `.cursor/skills/*/SKILL.md`, `AGENTS.md`.

---

## 1. Arquitetura do Dashboard Visual do `devworks-harness`

### 1.1 Stack e Runtime
- **Backend:** Servidor HTTP local em Python 3 stdlib (`ThreadingHTTPServer` em `127.0.0.1:<porta>`, default `7331`), zero dependências externas (`scripts/dashboard/server.py:16,1024`; launcher em `scripts/ralph-web.sh:8,104`).
- **Frontend:** SPA estática sem build step (`HTML + CSS + JS` vanilla) servida pelo mesmo processo em `scripts/dashboard/web/{index.html,app.js,app.css}` (`server.py:1007-1014`).
- **Testes:** Suite de integração real em `tests/test_dashboard.py` (417 linhas) que sobe `server.py` em porta efêmera com CLIs mockadas e valida stop de árvore de processos, cleanup de lock órfão, descoberta de modelos, parse de fases e disparo de `ralph.sh`.

### 1.2 Contrato de API (`api/v1/*`)

| Método | Endpoint | Responsabilidade | Referência |
|---|---|---|---|
| `GET` | `/api/v1/config` | Lê `config/harness.json` com defaults normalizados | `server.py:943-944` |
| `POST` | `/api/v1/config` | Valida e persiste `engines`, `models.{priority_queue,verify_queue}`, `limits.*` | `server.py:985-987` |
| `GET` | `/api/v1/inputs` | Descobre documentos elegíveis dentro de `.spec/` (`project-phases.md`, `features/<slug>`, `**/PHASES.md`) | `server.py:344-376,945-946` |
| `GET` | `/api/v1/engines` | Retorna engines configuradas (ou instaladas no `PATH`) | `server.py:135-140,947-948` |
| `GET` | `/api/v1/models?refresh=1` | Descobre modelos via CLIs (`agy`, `codex`, `opencode`, aliases `claude`) com cache de 300s | `server.py:27,305-342,949-951` |
| `GET` | `/api/v1/phases?input=...` | Faz parse dos headings `## Phase N:` + conta `- [ ]` + cruza status `done` com `.phases/progress/*.progress` | `server.py:421-481,952-955` |
| `GET` | `/api/v1/runs` | Lista histórico de execuções em `.phases/runs/run-*` marcando `current` | `server.py:675-692,958-959` |
| `GET` | `/api/v1/runs/current` ou `/{id}` | Retorna estado consolidado (`run.tsv` + overlay de `live.tsv`) | `server.py:648-673,961-968` |
| `GET` | `/api/v1/runs/{id}/logs?after=N` | Leitura incremental de logs por byte-offset (janela máxima de `256 KiB`) | `server.py:26,694-711,969-974` |
| `POST` | `/api/v1/runs` | Inicia `scripts/ralph.sh --headless` em background (`202 Accepted`), rejeitando se já houver run ativo ou input fora de `.spec/` | `server.py:483-568,988-990` |
| `POST` | `/api/v1/runs/stop` ou `/{id}/stop` | Encerra processo e descendentes (`SIGTERM` → espera 3s → `SIGKILL`), limpa `.ralph.lock`/`.lock` e marca `status=stopped` | `server.py:841-920,991-1004` |

### 1.3 Modelo de Dados e Atualização em Tempo Real
- **Sem SSE nem WebSocket:** O frontend faz **polling a cada 1 segundo** (`setInterval(refresh, 1000)` em `web/app.js:380`), disparando 3 requisições por tick (`/api/v1/runs`, `/api/v1/runs/<selected>`, `/api/v1/runs/<id>/logs?after=<offset>` — `app.js:293-294`).
- **Estado baseado em filesystem (TSV atômico):**
  - `.phases/current`: ponteiro texto simples com o `run_id` ativo (`ralph.sh:891-938`).
  - `.phases/runs/<run-id>/state/run.tsv`: tabela TSV com linhas `META\t<k>\t<v>`, `PHASE\t<num>\t<status>\t<attempt>\t<gates>\t<title>` e `TASK\t<phase>\t<num>\t<status>\t<title>` gravada atomicamente via `mv -f` (`ralph.sh:1124-1138`).
  - `.phases/runs/<run-id>/state/live.tsv`: progresso efêmero da sessão ativa (`PHASE`, `ACTIVITY`, `LIVE\t<task>\t<status>`), sobrescrito em tempo real pelo parser de stream (`stream_watch`).
  - `.phases/progress/<doc>-<sha256[:12]>.progress`: fases já concluídas (permite retomar e pré-selecionar apenas pendentes).
  - `.phases/.ralph.lock/pid`: lock exclusivo por `mkdir` atômico + PID do orquestrador (`ralph.sh:897-904`).

### 1.4 Interatividade vs. Read-Only
- **Interativo (controle real):**
  1. Toggle de engines habilitadas (`#engines-bar`) + atualização de catálogo de modelos (`#refresh-models`).
  2. Montagem e reordenação (`↑`/`↓`/`✕`) da fila de prioridade de modelos (`priority_queue`) e escolha opcional do verificador (`verify_queue`).
  3. Seleção de documento `.spec/` e checklist granular de fases com atalhos (`Pendentes`, `Todas`, `Nenhuma`).
  4. Configuração de limites (`implementation_minutes`, `verification_minutes`, `idle_warning_minutes`) e persistência em `config/harness.json`.
  5. Disparo (`Iniciar execução`) e encerramento seguro (`Encerrar Ralph` com confirmação e limpeza de lock órfão).
- **Read-Only (monitoramento):**
  - Cards de resumo (`Projeto`, `Engine`, `Modelo`, `Perfil`, `Status`, `Run`, `PID`, `Failovers`, `Duração`), barras de progresso (`Fases` e `Tasks`), detalhe de trabalho atual (`Fase`, `Ciclo`, `Gate`, `Atividade`, `Último erro`), tabela hierárquica `Fases / Tasks / Gates (G0..G3)` e viewer de logs com `Seguindo`/`Ir ao fim`.

### 1.5 Limitações Técnicas Críticas para o Nosso Ambiente (Windows)
- `server.py` depende de `ps -p` / `ps -A` (`server.py:726-782`), `os.kill(..., SIGKILL)` (`server.py:901-905`) e `subprocess.Popen(..., start_new_session=True)` (`server.py:562`), além de chamar `scripts/ralph.sh` (Bash). Em **Windows nativo**, tanto o gerenciamento de processos quanto o launcher `ralph-web.sh` (que só checa `open`/`xdg-open`, `ralph-web.sh:78-84`) falham sem WSL/Git Bash.
- Nosso harness já é **Node.js ESM** (`scripts/*.mjs`) e já implementa kill cross-platform de árvore de processos (`taskkill /pid <pid> /T /F` no Windows e `process.kill(-pid)` no POSIX — ver `scripts/gate.mjs:71-85`).

---

## 2. Análise Crítica de UX/Estética do `devworks-harness`

### 2.1 O que Aproveitar (Fluxo e Ergonomia Funcional)
1. **Descoberta dinâmica de modelos das CLIs** com badge de engine e indicação explícita de `CLI ausente` (`app.js:37-44`). Evita erro de digitação de model IDs.
2. **Fila de prioridade multi-engine transparente** com hint claro de failover automático e separação opcional de modelo para verificação (`index.html:25-43`).
3. **Pré-seleção inteligente de fases pendentes** ao carregar um documento (`app.js:175-176`) + botões rápidos `Pendentes / Todas / Nenhuma`.
4. **Split-view com Logs Sticky e Auto-Follow inteligente**: ao rolar para cima para inspecionar um erro, o auto-scroll pausa automaticamente (`nearLogEnd()` em `app.js:289-297`) e retoma ao voltar ao fim.
5. **Segurança local-first**: bind restrito a `127.0.0.1`, whitelist de caminhos dentro de `.spec/`, validação estrita de `run_id` por regex e sanitização `esc()` contra XSS em todo `innerHTML` (`app.js:11`).

### 2.2 O que Melhorar Radicalmente (Estética e UX para o Nosso Harness Hub)
| Dimensão | Como é no `devworks-harness` | Problema | Direção para o Nosso Harness Hub |
|---|---|---|---|
| **Identidade visual** | `ui-monospace` no `body` inteiro (`app.css:20`), `border-radius: 0`, azul-marinho saturado (`#06111d`/`#0b1d30`/`#285d88`), `h2` com margem negativa (`margin: -.9em`, `app.css:51`). | Aparência de "terminal TUI portada para HTML"; baixa hierarquia tipográfica e fadiga visual em sessões longas. | Tipografia mista (sans-serif moderna para UI + mono apenas para logs/IDs/comandos), superfície neutra refinada (dark/light mode), cantos suaves, elevação sutil e hierarquia clara de densidade. |
| **Arquitetura de informação** | Tudo empilhado em 1 página vertical: painel de setup sempre expandido acima do monitor (`index.html:20-98`). | Desperdiça metade da viewport com configuração mesmo quando o usuário só quer gerenciar tarefas ou acompanhar agentes. | Navegação dedicada por visões (sidebar limpa): **Visão Geral (Dashboard)**, **Kanban / Backlog**, **Agenda Semanal**, **Agentes & Execuções**, **Configuração Multi-AI**. |
| **Escopo de gestão** | Apenas 1 lista linear de fases de 1 `PHASES.md` por vez. Sem backlog, sem prioridades, sem calendário, sem multi-agentes. | Não cobre o fluxo diário de planejamento, priorização e delegação de um time de 14 agentes. | Kanban nativo espelhando o ciclo de `.specs/tasks/` + Backlog priorizado (`P0..P3`) + Agenda Semanal com time-blocking/entregas + painel de monitoramento e delegação para os 14 agentes. |
| **Interatividade** | Reordenação por botões `↑`/`↓`, feedbacks em um único `<div id="notice">` no topo (`index.html:12`), sem busca em logs. | Fricção para reordenar, feedback fora de vista quando a página está rolada, difícil depurar logs longos. | Drag-and-drop no Kanban e na fila de modelos, drawer de detalhe da task (ACs, arquivos, slices, evidências), toasts contextuais, busca/filtro de logs por agente/nível e streaming via **SSE**. |

---

## 3. Arquitetura Multi-AI do `devworks-harness` e Extensão para Cursor

### 3.1 Como o `devworks-harness` Suporta 4 Plataformas sem Duplicação
O padrão central é **"Fonte Canônica Única + Projeção de Descoberta por Plataforma"** (`docs/agents/canonical-workflows.md:3-5`):

1. **Skills canônicas:** Vivem em `skills/<nome>/SKILL.md` (`init`, `plan`, `task-builder`, `ai-context`).
2. **Instalador multi-plataforma (`scripts/install-platform.sh:162-173`):** Valida binário + `--version` de cada CLI selecionada (`--platform all` ou lista separada por vírgula), copia as skills para o diretório nativo de cada plataforma e grava `engines` em `config/harness.json`:
   - **Antigravity (`agy`):** `.agents/skills/` (project) | `~/.gemini/config/skills/` (user)
   - **Codex (`codex`):** `.agents/skills/` (project) | `~/.codex/skills/` (user)
   - **Claude Code (`claude`):** `.claude/skills/` (project) | `~/.claude/skills/` (user)
   - **OpenCode (`opencode`):** `.opencode/skills/` (project) | `~/.config/opencode/skills/` (user)
3. **Adaptadores de execução (`scripts/engines/<engine>.sh`):** Contrato mínimo de 5 funções:
   - `engine_binary()` / `engine_install_hint()`
   - `adapter_usage_pattern()`: regex de detecção de rate-limit/429/quota específica de cada CLI.
   - `adapter_run_engine_once(prompt_file, log_file, mode)`: encapsula flags de modo `impl` (escrita autônoma + `stream-json` alimentando `stream_watch`) vs. modo `verify` (sandbox estritamente read-only).
   - `adapter_gate0_validate(log_file)`: verifica evento terminal real no stream JSON (`"event":"result"` + `"status":"SUCCESS"` no `agy`; `"type":"result"` + `is_error!=true` no `claude`; `"type":"step_finish"` no `opencode`).

| Engine | Binário | Modo `impl` (autônomo) | Modo `verify` (read-only) | Descoberta de modelos (`server.py`) |
|---|---|---|---|---|
| **Antigravity** | `agy` | `agy -p ... --mode accept-edits --output-format stream-json --dangerously-skip-permissions` (`antigravity.sh:15-17`) | `agy -p ... --mode plan --sandbox --output-format text` (`antigravity.sh:11-12`) | `agy models` (fallback `config/model-policy.tsv`) |
| **Claude Code** | `claude` | `env -u CLAUDECODE claude --dangerously-skip-permissions -p ... --output-format stream-json --verbose` (`claude.sh:18-19`) | `--allowedTools "Read,Glob,Grep" --output-format text` (`claude.sh:13-14`) | Aliases estáticos CLI (`sonnet`, `opus`, `haiku`, versões 4.x) |
| **Codex** | `codex` | `codex exec --sandbox danger-full-access ...` (`codex.sh:15`) | `codex exec --sandbox read-only ...` (`codex.sh:13`) | `codex debug models` (fallback `~/.codex/models_cache.json`) |
| **OpenCode** | `opencode` | `opencode run --auto --format json` (`opencode.sh:17`) | `OPENCODE_CONFIG_CONTENT='{"permission":{"*":"deny","read":"allow","glob":"allow","grep":"allow"}}'` (`opencode.sh:13-14`) | `opencode models` |

### 3.2 Como Estender para Multi-AI (Antigravity, Claude, Codex e **Cursor**) no Nosso Harness
Hoje nosso harness tem `.claude/{rules,agents,skills,templates}`, `CLAUDE.md` e `AGENTS.md`. Para suportar nativamente **Antigravity + Claude + Codex + Cursor** sem drift:

1. **Fonte canônica única:** Manter regras, agentes e skills em uma única árvore canônica (`.claude/` no curto prazo, mantendo compatibilidade total com `scripts/validate-harness.mjs`) e gerar projeções via instalador unificado (`scripts/sync-platforms.mjs` integrado ao `install.ps1` / `install.sh`):
   - **Claude Code:** `CLAUDE.md` + `.claude/{rules,agents,skills}` (nativo).
   - **Antigravity & Codex:** `AGENTS.md` (já existente) + projeção de skills em `.agents/skills/<skill>/SKILL.md`.
   - **Cursor:** `AGENTS.md` (lido globalmente pelo IDE e pela CLI) + projeção das regras `.claude/rules/*.md` para `.cursor/rules/*.mdc` (com frontmatter YAML `alwaysApply: true` ou `globs` quando aplicável) + projeção de skills em `.cursor/skills/<skill>/SKILL.md`.
2. **Adaptador de execução para Cursor CLI:**
   - A CLI do Cursor executa em modo headless via `agent -p "<prompt>"` (lendo automaticamente `AGENTS.md`, `.cursor/rules` e `.cursor/skills`).
   - Modo `impl`: `agent -p --force "<prompt>"` (permite edição + execução autônoma de comandos).
   - Modo `verify` / read-only: `agent -p "<prompt>"` sem `--force` (bloqueia comandos shell não pré-aprovados) + verificação determinística externa via `scripts/gate.mjs`.
3. **Verificação anti-drift:** Assim como `devworks-harness` possui `scripts/check-skill-drift.sh`, estender `scripts/validate-harness.mjs` para garantir que projeções (`.agents/skills`, `.cursor/rules`, `.cursor/skills`) nunca divirjam da fonte canônica.

---

## 4. Loop de Execução Autônoma (`ralph.sh`) e Mapeamento para Nosso Modelo

### 4.1 Como Funciona o `ralph.sh`
Os 5 invariantes (`scripts/ralph.sh:9-17`):
1. **Sessão limpa por fase e por ciclo de correção** (nunca reutiliza contexto sujo).
2. **Zero perguntas** (execução contínua até completar ou falhar após `MAX_CYCLES`, default 3).
3. **4 Gates mecânicos** (`ralph.sh:2077-2326`):
   - **Gate 0:** Engine concluiu de verdade (exit code 0 + evento terminal válido no JSON).
   - **Gate 1:** Sinal de escrita via `tree_signature()` (git status + diff + sha256 dos untracked excluindo `.phases`). Não reprova sozinho (permite fase já implementada), mas força Gate 3 e alimenta diagnóstico.
   - **Gate 2:** Suite de testes do projeto rodada **fora** da sessão do agente (`--test-cmd` / `RALPH_TEST_CMD` / auto-detecção por manifest).
   - **Gate 3:** Sessão verificadora independente em **sandbox read-only**, conferindo task por task (`- [ ]`) no código real.
4. **Failover resiliente a rate-limit** (`ralph.sh:2012-2067`): Ao detectar erro de quota/429 (`detect_usage_limit`), desabilita a rota atual em `DISABLED_ROUTES` e salta automaticamente para a próxima rota `engine:model` em `IMPLEMENTATION_ROUTES` (ou `VERIFY_ROUTES`) **sem consumir ciclo de correção**; só entra em `wait_for_reset` se todas as rotas se esgotarem.
5. **Zero commits automáticos:** Preserva diff na working tree para revisão humana.

### 4.2 Mapeamento para `.specs/tasks/` e Nossos 14 Agentes

| Conceito no `devworks-harness` | Equivalente no Nosso Harness (`C:\Estudos\workflow`) | Evolução Recomendada no Harness Hub |
|---|---|---|
| `PHASES.md` (`## Phase N:` + `- [ ]`) | `.specs/tasks/task-<slug>.md` validado por `scripts/validate-task.mjs` | **Card de Kanban** com `## Status:`, progresso por ACs (`- [ ]`/`- [x]`), `## Files` e `## Slices` (paralelismo seguro). |
| Status simples (`pending`, `running`, `done`, `failed`) | Máquina de estados rica (`PLANNING → IN_PROGRESS → IN_REVIEW → READY_TO_COMMIT → COMMITTED → SHIPPED` + `BLOCKED(<prev>)`) | Colunas nativas do Kanban; mover card ou avançar pipeline atualiza `## Status:` no arquivo Markdown (fonte única de verdade). |
| 2 papéis (`impl` e `verify`) | **14 agentes** (`@explorer`, `@researcher`, `@product-manager`, `@tech-lead`, `@developer`, `@ai-engineer`, `@designer`, `@qa-engineer`, `@code-reviewer`, `@security-auditor`, `@debugger`, `@tech-writer`, `@devops`, `@committer`) | **Roteamento de Engine por Perfil de Agente** (ex.: *Planning*, *Build*, *Audit/Review*, *Scout*) com fila de failover cross-engine (`antigravity`, `claude`, `codex`, `cursor`) por perfil. |
| Gate 2 (auto-detecção de teste) | `scripts/gate.mjs` (lê tabela `## Verification` de `CLAUDE.md` com baselines `exit0` e `max:<N>:<regex>`) | Executar `node scripts/gate.mjs` diretamente como gate determinístico e exibir status de cada linha da tabela no Hub. |
| Gate 3 (verificador único) | Painel independente por tier (`.claude/rules/10-orchestration.md:45-56`: `@code-reviewer` + `@security-auditor` + `@qa-engineer`) | Disparar revisão independente com o agente apropriado e exigir `STATUS: DONE` no `## Handoff` + evidência em cada AC antes de `READY_TO_COMMIT`. |
| Lock único global (1 run por repo) | Regra #3 de `AGENTS.md`: *"Two writers never edit the same file"* + tabela `## Slices` validada em `validate-task.mjs:60-69` | Permitir **execução paralela de múltiplos agentes** desde que operem em slices com `Files` disjuntos (ou agentes read-only como `@explorer`/`@researcher`/`@code-reviewer`). |

---

## 5. Recomendações Concretas

### 5.1 Para `@product-manager` (Definição de MVP vs. Fase 2)
Sugestão de fatiamento para entregar valor imediato sem travar na complexidade de orquestração headless:

- **MVP (Fase 1 — Visual Hub + Gestão + Multi-AI Sync):**
  1. **Dashboard Geral:** Resumo de tasks por status, progresso de ACs, saúde dos gates (`gate.mjs` + `validate-harness.mjs`) e status das CLIs instaladas (`agy`, `claude`, `codex`, `cursor`).
  2. **Kanban + Backlog & Prioridades:** Leitura/escrita direta de `.specs/tasks/*.md` (status, prioridade `P0–P3`, tier `T1–T3`, ACs interativos, drawer com problema/arquivos/slices).
  3. **Agenda Semanal:** Planejamento visual da semana vinculando tasks do backlog/Kanban a dias/blocos de foco.
  4. **Painel de Agentes (Catálogo & Delegação Assistida):** Visualização dos 14 agentes, seus papéis/modelos e geração/disparo de briefs estruturados + configuração de `config/harness.json` (engines habilitadas e filas de prioridade).
  5. **Multi-AI Installer/Sync:** Suporte oficial para instalar e manter em sincronia **Claude Code, Antigravity, Codex e Cursor**.

- **Fase 2 (Execução Autônoma & Observabilidade Real-Time):**
  1. **Runner Autônomo Node.js (inspirado no `ralph.sh`):** Execução de slices/tasks via adaptadores CLI (`antigravity`, `claude`, `codex`, `cursor`) com failover automático em 429/quota.
  2. **Monitoramento em Tempo Real via SSE:** Stream ao vivo de atividade por agente, logs filtráveis com auto-follow, visualização dos gates (`validate-task` → `gate.mjs` → `@code-reviewer`/`@qa-engineer`) e botão seguro de `Stop` cross-platform.

### 5.2 Para `@tech-lead` (Decisões Arquiteturais Recomendadas)
1. **Runtime 100% Node.js ESM (sem Python/Bash obrigatório):** Construir o servidor local do Harness Hub em Node.js (`scripts/hub/` ou pacote dedicado) para garantir funcionamento nativo idêntico em **Windows, macOS e Linux**, reutilizando a lógica cross-platform de `scripts/gate.mjs` e `scripts/validate-task.mjs`.
2. **SSE (`text/event-stream`) + `fs.watch` em vez de Polling 1s:** Elimina 3 requisições HTTP/s ociosas, entrega logs e mudanças em `.specs/tasks/*.md` com latência instantânea e simplifica sincronização entre edições feitas na IDE/CLI e no Hub.
3. **Markdown como Fonte Única de Verdade (Zero Lock-in em Banco):**
   - Tasks continuam vivendo em `.specs/tasks/task-<slug>.md` (compatíveis com `scripts/validate-task.mjs`).
   - Metadados puramente de planejamento do Hub (prioridade `P0–P3`, ordem no backlog, alocação na agenda semanal, configuração de filas Multi-AI) devem ficar em arquivos JSON leves e versionáveis (ex.: `.specs/hub-state.json` ou `config/harness.json`) para não poluir nem quebrar o parser atual de `validate-task.mjs`.
4. **Camada de Adaptadores Multi-AI Desacoplada:** Definir uma interface clara em JS (`adapters/{antigravity,claude,codex,cursor}.mjs`) com `detectCli()`, `listModels()`, `run({ prompt, mode, model, cwd, onEvent })`, `isRateLimited(output)` e `syncProjectConfig(root)`.
5. **Governança do Harness:** Toda adição de regra/skill/script deve manter `node scripts/validate-harness.mjs` e `node evals/scripts/selftest.mjs` verdes, respeitando o teto de contexto (`MAX_ALWAYS_BYTES = 33000` e `MAX_DESC_CHARS = 19300` em `scripts/validate-harness.mjs:9-10`).

---

## Handoff

- **STATUS:** DONE
- **SUMMARY:** Analisei diretamente o código-fonte do repositório `ArthurDevWorks/devworks-harness` (dashboard HTTP/JS/CSS, testes, adaptadores de 4 engines, docs de agentes, `ralph.sh`, `install-platform.sh` e configs) e comparei com a arquitetura do nosso harness (`CLAUDE.md`, `10-orchestration.md`, `validate-harness.mjs`, `validate-task.mjs`, `gate.mjs`). Produzi o relatório comparativo acionável em `.specs/docs/research-devworks-harness.md` cobrindo arquitetura do dashboard, crítica de UX/estética, estratégia Multi-AI com extensão para Cursor, mapeamento do loop autônomo para `.specs/tasks/` e 14 agentes, além de recomendações de MVP (`@product-manager`) e arquitetura (`@tech-lead`).
- **EVIDENCE:** Leitura direta de `scripts/dashboard/server.py` (1034 linhas), `scripts/dashboard/web/{index.html,app.js,app.css}`, `tests/test_dashboard.py` (417 linhas), `scripts/engines/{antigravity,claude,codex,opencode}.sh`, `docs/agents/*.md`, `config/{harness.json,model-policy.tsv}`, `README.pt-BR.md`, `scripts/{ralph.sh,ralph-web.sh,install-platform.sh}`, `CLAUDE.md`, `.claude/rules/10-orchestration.md`, `scripts/{validate-harness.mjs,validate-task.mjs,gate.mjs}` e verificação via web search dos contratos headless e de diretórios do Cursor CLI.
- **FILES:** `C:\Estudos\workflow\.specs\docs\research-devworks-harness.md`
- **DECISIONS:** Nenhuma decisão de código tomada (papel read-only de pesquisa); recomendações estruturadas em MVP vs. Fase 2 e runtime Node.js ESM + SSE + adaptadores Multi-AI (`antigravity`, `claude`, `codex`, `cursor`).
- **CONCERNS:**
  - O modelo `server.py` + `ralph.sh` do `devworks-harness` depende fortemente de ferramentas POSIX (`ps`, `bash`, `SIGTERM`/`SIGKILL`, `open`/`xdg-open`) e não funciona nativamente no Windows; copiar a implementação em Python/Bash introduziria fragilidade no ambiente do usuário.
  - Adicionar projeções Multi-AI (`.cursor/rules`, `.cursor/skills`, `.agents/skills`) exige disciplina anti-drift no `validate-harness.mjs` e atenção ao teto `MAX_ALWAYS_BYTES`/`MAX_DESC_CHARS`.
- **NEEDS:** `@product-manager` para definir o PRD/MVP do Harness Hub (Kanban, Backlog, Prioridades, Agenda Semanal, Agentes e Multi-AI) e `@tech-lead` para fechar a arquitetura do servidor local Node.js + SSE + engine adapters.
