# Roadmap Fase 2 — Harness Hub (Evolução Pós-MVP)

Ideias estratégicas levantadas em brainstorm para evoluir o Harness Hub MVP em um ambiente completo estilo IDE/Mission Control com autonomia total.

---

## Épico 1 — Ambientes Isolados (Workspaces: Trabalho × Faculdade × Pessoal)
- **Objetivo:** Separar completamente contextos distintos (ex.: `Trabalho`, `Faculdade`, `Pessoal`) para evitar mistura visual e conflito de execução entre agentes.
- **Hierarquia sugerida:**
  - `Ambiente (Workspace)` → ex.: `Faculdade`, `Trabalho`
  - `Pasta / Matéria / Projeto` → ex.: `Sistemas Distribuídos`, `Banco de Dados`, `API Pagamentos`
  - `Sessões` → `Projeto`, `Estudo`, `Material / Notas`, `Revisão`
- **Isolamento técnico:**
  - Cada ambiente aponta para seu próprio `rootDir` (ou namespace isolado em `.specs/workspaces/<slug>/`), com seu próprio `board.json`, fila de prioridade e diretório de `locks/`.
  - Agentes executando em `Trabalho` nunca interferem, pausam ou disputam locks com agentes rodando em `Faculdade`.
  - Seletor rápido de ambiente no topo da sidebar (inspirado em IDEs como Antigravity / VS Code / Claude).

## Épico 2 — Parecer do Dia (Daily Briefing)
- **Objetivo:** Ao abrir o Hub (ou retornar após se afastar), exibir em 1 tela um resumo executivo automático:
  - Tarefas agendadas para **hoje** na Agenda Semanal.
  - **PRs no GitHub** aguardando seu review (`review-requested:@me`) e **Issues** novas atribuídas a você.
  - **Execuções em segundo plano:** o que terminou enquanto você esteve fora, o que ainda está rodando e o que parou aguardando sua decisão (Level C / Bloqueado).
  - Status consolidado dos gates de qualidade.

## Épico 3 — Catálogo e Gestão de Ferramentas & MCPs por Ambiente
- **Objetivo:** Visualizar, ativar/desativar e configurar servidores MCP (GitHub, Playwright, Filesystem, Banco de Dados, Notion, Figma, etc.) diretamente pelo Hub.
- **Comportamento:**
  - Leitura real de `.mcp.json` / `.claude/settings.json` / configs do Antigravity e Cursor.
  - Atribuição de MCPs por ambiente (ex.: MCP de GitHub/Jira no ambiente `Trabalho`; MCP de PDF/Notas/Pesquisa no ambiente `Faculdade`).
  - Indicador de saúde (conectado / erro / sem credencial) sem nunca expor segredos na UI.

## Épico 4 — Chat Integrado por Ambiente (Delegação por Prompt)
- **Objetivo:** Um painel de chat acoplado ao ambiente ativo para conversar, refinar ideias e delegar tarefas sem precisar abrir o terminal.
- **Fluxo:**
  1. Você escreve um pedido em linguagem natural no chat do ambiente (ex.: *"revisa o PR #42 e cria um card para corrigir os pontos críticos"*).
  2. O Hub aplica automaticamente a regra `80-prompt-amplifier.md` (4 perguntas + prompt reescrito).
  3. O Maestro/agente escolhido cria ou atualiza cards no Kanban, dispara a execução e responde no chat com links clicáveis para os cards, logs e diffs.

## Épico 5 — Failover Automático de Engines de IA (Cota / 429)
- **Objetivo:** Configurar uma fila de fallback (ex.: `Claude -> Antigravity -> Codex -> Cursor`) para que, ao detectar `429 / RESOURCE_EXHAUSTED`, o runner troque de engine automaticamente preservando o contexto do task file sem travar a fila.
