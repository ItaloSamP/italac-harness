# Brief amplificado: Harness Hub (painel visual + Multi-AI)

Prompt original: transformar o workflow num harness com painel visual interativo (dashboard, kanban, backlog, prioridades, agenda semanal, monitor de agentes), versátil entre IAs (Antigravity, Claude, Codex, Cursor), com MVP, HUs, protótipo, docs e git, usando os agentes do time.

## 1. O que um profissional de alto nível faria e não foi pedido

- **Tratar o painel como uma *view* do harness, não como uma segunda fonte de verdade.** Os task files em `.specs/tasks/` continuam sendo o estado oficial. O Hub lê esses arquivos, valida e escreve neles. Um banco paralelo divergiria do que os agentes leem.
- **Fazer cumprir as invariantes do harness na UI.** O drag & drop só aceita transições válidas da máquina de estados (`10-orchestration.md`). Só o `@committer` comita. O autor não revisa o próprio trabalho T2+. Ações Level C (push, PR, deploy) exigem confirmação humana e nunca são executadas pelo Hub.
- **Fila *pull*, não *push*, com claim atômico.** Agentes de qualquer IA pedem o próximo item e reivindicam com lock em arquivo. Assim dois agentes nunca pegam a mesma tarefa, e o Hub não precisa saber disparar cada CLI (isso fica para a Fase 2).
- **Fonte canônica única, com projeções por IA e detecção de drift.** As regras não são copiadas à mão para cada ferramenta: são geradas, e um hash mostra quando uma projeção ficou desatualizada.
- **Respeitar os orçamentos de contexto que já estão no teto** (32968/33000 B sempre carregados; 19210/19300 caracteres de descrições). Ensinar os agentes a usar a fila não pode estourar esses orçamentos.
- **Cross-platform de verdade.** A referência (`devworks-harness`) depende de POSIX e quebra no Windows, que é o ambiente do usuário.

## 2. Material mais bruto

- O código-fonte do `devworks-harness` (clonado), não o README: `scripts/dashboard/server.py`, `web/*`, `engines/*.sh`, `install-platform.sh`, `tests/test_dashboard.py`.
- As regras e scripts reais deste harness: a máquina de estados em `scripts/validate-task.mjs`, `gate.mjs`, `incident.mjs`, `.specs/harness/incidents.jsonl` (44 incidentes reais) e o validador com os tetos de orçamento.
- As convenções atuais documentadas de cada IA (`AGENTS.md` para Codex, `.cursor/rules/*.mdc` para Cursor, `GEMINI.md` para Antigravity e `CLAUDE.md` + `.claude/` para Claude).

## 3. Métodos e ferramentas

- **Produto:** JTBD, corte de escopo MoSCoW, HUs com ACs testáveis (`@product-manager`).
- **Arquitetura:** ADRs, contrato de API e da CLI, fatiamento em slices sem arquivos compartilhados, que é o que `validate-task.mjs` verifica (`@tech-lead`).
- **Runtime:** Node 24 sem dependências (`node:http`, `fs.watch`, SSE, `node:test`). Frontend em vanilla ESM, sem etapa de build, para os instaladores copiarem como está.
- **Design:** tokens com contraste WCAG AA medido, todos os estados de cada tela, alternativa de teclado para todo drag (`@designer`).
- **Verificação:** `node:test`, requisições HTTP reais, screenshots com Playwright em 1440/1024/768/390, revisão adversarial (`@code-reviewer`), auditoria de segurança da superfície HTTP e de arquivos (`@security-auditor`).

## 4. O que comprova que está certo (além de nós)

- `node scripts/validate-harness.mjs` e `node evals/scripts/selftest.mjs` verdes, com os orçamentos respeitados.
- `node scripts/validate-task.mjs` aceitando os task files que o Hub escreve.
- Os testes `node:test` do Hub, incluindo duas tentativas de claim concorrentes em que exatamente uma vence.
- Um teste ponta a ponta: criar uma tarefa via HTTP, mover, reivindicar via CLI e ver o evento SSE chegar.
- O verificador de drift detectando uma projeção alterada à mão.
- O instalador gerando uma cópia que valida numa pasta vazia.
- Um revisor independente (`@code-reviewer`, `@qa-engineer`) que não escreveu o código.

## Prompt reescrito

> Construa o **Harness Hub**, um painel local (Node 24, sem dependências, roda no Windows/macOS/Linux, 127.0.0.1) que é uma *view* operável dos task files em `.specs/tasks/`. Telas: Mission Control, Kanban do ciclo real (drag & drop só nas transições válidas), Backlog/Prioridades, Fila de Demanda *pull* com claim atômico, Agenda Semanal (Seg–Dom, agente/IA/destino), Monitor dos 14 agentes e incidentes, e Hub Multi-AI. O Hub faz cumprir as invariantes do harness e nunca executa ações Level C. Gere as regras para Antigravity, Claude, Codex e Cursor a partir de uma fonte canônica, com detecção de drift, sem estourar os orçamentos de contexto. Comece pelo código-fonte do `devworks-harness` e pelos scripts deste repositório. Entregue PRD com HUs testáveis, spec com ADRs e slices, design system com todos os estados, o protótipo funcional e docs, com commits via `@committer`.
> **Prova:** validator + selftest + `validate-task` verdes, testes `node:test` (incluindo claim concorrente), um teste ponta a ponta via HTTP/CLI/SSE, o drift detectado, screenshots em 4 larguras e aprovação do `@code-reviewer` e do `@qa-engineer`.
