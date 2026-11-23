# Especificação de Telas e Fluxos — Harness Hub

**Versão:** 1.0  
**Data:** 2026-11-23  
**Autor:** `@designer`  
**Baseado em:** `.specs/docs/prd-harness-hub.md`, `.specs/docs/research-devworks-harness.md`, `context/DESIGN.md`, `.claude/rules/80-prompt-amplifier.md`  
**Idioma da UI:** Português do Brasil (`pt-BR`)

---

## 1. Arquitetura do Shell da Aplicação (`S0`)

O Harness Hub substitui a página vertical monolítica do `devworks-harness` por um **Shell de Mission Control** com 4 zonas estruturais:

```
┌──────────────────┬────────────────────────────────────────────────────────────┐
│  SIDEBAR (236px) │ TOPBAR (54px): Título | Busca (Ctrl+K) | SSE | Tema | +Nova│
│                  ├────────────────────────────────────────────────────────────┤
│  [Harness Hub]   │ [Banner Global condicional: Desconectado dos arquivos]     │
│                  ├────────────────────────────────────────────────────────────┤
│  • Mission Ctrl  │                                                            │
│  • Kanban        │                   ÁREA PRINCIPAL DA VISÃO                  │
│  • GitHub Inbox  │             (scroll independente por visão)                │
│  • Fila Demanda  │                                                            │
│  • Agenda Sem.   │                                                            │
│  • Agentes   [N] │                                                            │
│  • Hub Multi-AI  │                                                            │
│                  ├────────────────────────────────────────────────────────────┤
│  ──────────────  │ CONSOLE DE EXECUÇÃO AO VIVO (Dock colapsável: 40px / 260px)│
│  [Auto-exec ON]  │ [● Executando @developer · claude] [1→2→3→4] [Parar] [^]   │
└──────────────────┴────────────────────────────────────────────────────────────┘
```

### 1.1 Barra Lateral (`<aside aria-label="Navegação principal">`)
- **Largura:** `236px` (desktop `>= 1280px`), colapsável para `64px` (somente ícones + tooltip) em `1024px`, vira drawer deslizante via botão hambúrguer em `<= 768px`.
- **Cabeçalho da marca:** Logotipo geométrico SVG (`20×20`) + `Harness Hub` (`14px`, semibold) + tag mono discreta `127.0.0.1` indicando execução local-first.
- **Itens de navegação (ordem operacional):**
  1. `Mission Control` (`icon-radar`) — tela inicial padrão (AC-01.1).
  2. `Kanban & Backlog` (`icon-columns`) — badge numérico com total de tarefas não terminais.
  3. `GitHub Inbox` (`icon-github`) — badge numérico com issues abertas atribuídas ao usuário (ou ponto cinza se não configurado).
  4. `Fila de Demanda` (`icon-list-ordered`) — badge com itens elegíveis prontos para reivindicação.
  5. `Agenda Semanal` (`icon-calendar`) — badge com itens agendados para hoje.
  6. `Monitor de Agentes` (`icon-users`) — badge em âmbar/coral se houver incidentes abertos (AC-13.3) ou agentes bloqueados.
  7. `Hub Multi-AI` (`icon-cpu`) — indicador `K/4` (verde se `4/4`, âmbar se houver Drift).
- **Rodapé da sidebar:**
  - **Toggle rápido "Auto-executar ao arrastar para Em Progresso"** (`role="switch"`, persistido em `localStorage`, espelhado na barra do Kanban).
  - Indicador de saúde resumido dos gates (`Gates: PASS` / `FAIL`) clicável para saltar ao painel de Gates.

### 1.2 Barra Superior (`<header>`)
- **Esquerda:** Breadcrumb / título da visão atual (`--text-md`, semibold) + subtítulo contextual (ex.: nome do repositório `workflow` em mono).
- **Centro-direita:**
  - **Botão Command Palette:** campo simulado com `icon-search`, placeholder `"Buscar tarefas, agentes ou ações…"` e tecla `<kbd>Ctrl K</kbd>` (`⌘ K` no macOS).
  - **Pílula SSE ao vivo (`role="status"`):**
    - `Conectado (SSE)` — ponto verde/teal estável, tooltip com horário do último evento.
    - `Reconectando…` — ponto âmbar pulsante.
    - `Desconectado` — ponto coral; ativa automaticamente o banner persistente de desconexão (AC-16.4) e desabilita controles de escrita.
  - **Botão GitHub Inbox rápido** (`icon-github` com contador) — abre o **GitHub Issues Drawer** sobre o Kanban (para arrastar/importar sem sair do quadro) ou navega à aba dedicada.
  - **Toggle de Tema** (`icon-sun` / `icon-moon`, `aria-label="Alternar tema claro/escuro"`).
  - **CTA Global:** `+ Nova tarefa` (`.btn-primary`, atalho `N` fora de inputs).

### 1.3 Command Palette (`Ctrl+K` / `Cmd+K`)
- Modal centralizado (`max-width: 560px`, topo `14vh`, `role="dialog"`, `aria-label="Paleta de comandos"`).
- Busca instantânea com navegação por setas `↑`/`↓`, `Enter` para executar, `Esc` para fechar:
  - **Navegar:** pular para qualquer uma das 7 visões.
  - **Tarefas:** filtrar por título, ID (`task-*`), agente ou prioridade (`P0`).
  - **Ações rápidas:** `Nova tarefa`, `Abrir GitHub Issues Inbox`, `Rodar gate: harness`, `Rodar gate: selftest`, `Sincronizar todas as IAs`, `Alternar Auto-executar`, `Alternar tema`, `Abrir/Fechar Console de Execução`.

---

## 2. Especificação das Telas e Drawers

### 2.1 `S1` — Mission Control (Visão Geral)
**Meta (O1):** responder em `<= 10s` e `0 cliques` o que está rodando, bloqueado, aguardando decisão e se o harness está saudável.

- **Linha 1 — Faixa de KPIs (Grid responsivo 6 colunas em 1440px, 3×2 em 1024px):**
  1. **Em execução** (`IN_PROGRESS + IN_REVIEW` reivindicadas) — acento `--status-running-text`.
  2. **Bloqueadas** (`BLOCKED`) — acento `--status-danger-text` se `> 0`.
  3. **Aguardando você** (*Needs from user* ou `BLOCKED` por decisão humana) — clicável; abre Kanban filtrado (AC-01.5).
  4. **P0 abertas** — acento `--prio-p0-text` se `> 0`.
  5. **Progresso de ACs** — `X/Y` com mini-barra de progresso horizontal (`4px`).
  6. **Paridade Multi-AI** — `K/4 em paridade` (AC-01.8), clicável para `S8`.
- **Linha 2 — Barra de Distribuição do Ciclo (faixa compacta de 1 linha):**
  - Contadores clicáveis para todos os 9 status (`PLANNING`, `IN_PROGRESS`, `IN_REVIEW`, `READY_TO_COMMIT`, `COMMITTED`, `SHIPPED`, `BLOCKED`, `CANCELLED`, `SUPERSEDED`) + 2 contadores rápidos **"Em correção"** (Bug/Hotfix) e **"Em prototipagem"** (Prototype) — cada um abre o Kanban com filtro aplicado.
- **Linha 3 — Grid Assimétrico 2 Colunas (`7fr / 5fr` em 1440px):**
  - **Coluna Esquerda (Operação Viva):**
    - **Card "Em execução agora"** (máx. 5 itens, AC-01.3): lista cada run ativo com título, badge `@agente`, badge IA (`claude`, `agy`, `codex`, `cursor`), etapa atual (`Executando`), cronômetro `hh:mm` tabular e botão `Ver log` (abre o Console ao Vivo focado naquele run).
    - **Card "Bloqueadas & Aguardando decisão"** (AC-01.4): lista cada tarefa `BLOCKED(<prev>)` com selo `estava em <prev>`, o motivo literal do arquivo e botão `Abrir tarefa` (`S3`).
    - **Card "Saúde dos Gates"** (HU-02): tabela dinâmica lida da seção *Verification* (`harness`, `selftest`, etc.) com colunas: Gate, Comando (mono), Resultado (`PASS` + contagem de warnings ex. `1 warning` / `FAIL` / `Nunca executado`), Última execução e botão `Rodar` (`.btn-secondary .btn-sm`). Em `FAIL`, accordion expansível inline exibe as últimas 50 linhas da saída em `--bg-inset`.
  - **Coluna Direita (Governança & Pulso):**
    - **Card "Incidentes abertos do harness"** (AC-13.3): contador grande + top 3 incidentes abertos (chave, camada, data) + link `Ver todos no Monitor de Agentes`.
    - **Card "Atividade recente"** (AC-01.9): feed vertical rolável dos últimos 20 eventos em ordem decrescente — cada linha exibe horário mono (`18:42`), ator (`Usuário` ou `@agente · IA`), ícone de evento e descrição objetiva.
- **Estado Vazio (AC-01.10):** quando `totalTarefas === 0`, todos os contadores mostram `0` e a área "Em execução" exibe o cartão de boas-vindas *"Nenhuma tarefa no repositório ainda"* com dois CTAs: **`+ Criar primeira tarefa`** (primário) e **`Importar do GitHub Inbox`** (secundário).

---

### 2.2 `S2` — Kanban & Backlog (Experiência Trello/Podio + Dois Quadros)
**Propósito:** oferecer uma experiência espaçosa, nítida e prazerosa de operar — permitindo criar tarefas direto em qualquer coluna, organizar o que você quer fazer e acompanhar o que os agentes estão executando, respeitando todas as invariantes do harness (§8).

- **Barra de Controle Superior (Toolbar limpa e bem respirada):**
  - **Seletor de Perspectiva do Quadro (Segmented Control destacado à esquerda):**
    - **`Dois Quadros: Planejamento + Execução`** *(padrão)* — separa claramente o espaço de decisão humana (Quadro 1) do pipeline vivo dos agentes (Quadro 2), com drag & drop fluido entre ambos.
    - **`Kanban Unificado`** — exibe as 6 colunas estritas do ciclo do harness (`PLANNING`, `IN_PROGRESS`, `IN_REVIEW`, `READY_TO_COMMIT`, `COMMITTED`, `SHIPPED`) em uma faixa contínua (AC-03.1).
  - **Filtros rápidos (pills):** `Todas`, `Bloqueadas (N)`, `Em correção`, `Em prototipagem`, `Aguardando você`, `P0`.
  - **Filtros combináveis (E lógico, AC-03.7):** botão/popover ou selects compactos para `Agente`, `Prioridade`, `Tier`, `Tipo`, `IA alvo` + `Limpar filtros`.
  - **Controles operacionais à direita:**
    - **Toggle `Auto-executar ao arrastar para Em Execução`** (`role="switch"`) com tooltip: *"Quando ativo, mover um card para Em Execução (`IN_PROGRESS`) dispara automaticamente o agente + IA atribuídos e abre o Console ao Vivo."*
    - **Botão `GitHub Inbox (N)`** (`icon-github`): abre o Drawer de GitHub Issues lado a lado com os quadros para importação em 1 clique ou drag direto.
    - **Botão `+ Nova tarefa`** (`.btn-primary`, abre `S4`).

- **Modo Padrão — `Dois Quadros: Planejamento + Execução` (Layout Espaçoso em 2 Faixas):**
  - Espaçamento generoso entre quadros (`24px`), colunas com largura confortável (`min-width: 290px`, `padding: 12px`, `gap: 10px` entre cards) e cabeçalhos de quadro com título, subtítulo explicativo e contador agregado — nunca apertado.
  - **Quadro 1 — Planejamento (*"O que eu quero fazer"*):**
    - Moldura sutil em `--bg-surface` com cabeçalho próprio (`Planejamento · N tarefas`).
    - **3 colunas:**
      1. **`Planejado`** — backlog pronto e ideias estruturadas (`PLANNING` sem agenda).
      2. **`Agendado`** — tarefas com dia definido na Agenda Semanal (`PLANNING` + data agendada; arrastar para cá abre popover rápido de data).
      3. **`A Corrigir`** — bugs, hotfixes e ajustes pendentes (tipo `Bug`/`Hotfix` ou retorno de revisão).
    - **Criação direta estilo Trello em cada coluna:** botão `+ Nova tarefa` visível no topo e no rodapé de **cada coluna** (não depende do GitHub Inbox). Clicar abre um *inline quick-create card* na própria coluna (input de título + seletor rápido de Prioridade/Agente + `Enter` cria imediatamente no contexto da coluna — ex.: em `A Corrigir` pré-define tipo `Bug`, em `Agendado` sugere data de hoje — e link `Formulário completo` para abrir `S4`).
  - **Quadro 2 — Execução (*"O que está sendo feito pelos agentes"*):**
    - Moldura com acento lateral sutil `--life-in-progress` e cabeçalho próprio (`Execução dos Agentes · M ativas` + pílula clicável **`Bloqueadas (K)`**).
    - **5 colunas:**
      1. **`Executar (Fila)`** — tarefas elegíveis prontas na fila de demanda (`PLANNING` prontas para disparo). Também possui `+ Nova tarefa` rápido no rodapé para colocar trabalho direto na fila.
      2. **`Em Execução`** (`IN_PROGRESS`) — acento `--life-in-progress`; soltar um card aqui com Auto-executar ON dispara o agente + IA automaticamente, acende o indicador pulsante no card e expande o Console ao Vivo.
      3. **`Em Revisão`** (`IN_REVIEW`) — acento `--life-in-review`; mostra progresso de revisores obrigatórios.
      4. **`Pronto`** (`READY_TO_COMMIT`) — acento `--life-ready`; pronto para `@committer`.
      5. **`Feito`** (`COMMITTED` / `SHIPPED`) — acento `--life-committed`; exibe selo distinto `Comitado` (`icon-lock`, exclusivo `@committer`) ou `Publicado` (`icon-rocket`, exige Diálogo Level C `S9`).
    - **Raia/Filtro `Bloqueadas` (`BLOCKED(<prev>)`):** faixa horizontal dedicada no topo ou base do Quadro 2 (sempre visível quando `>= 1` bloqueada, ou filtrável pela pílula `Bloqueadas`) exibindo `estava em <prev>`, motivo literal e botão rápido `Desbloquear` (AC-07.2).
    - **Área recolhível `Encerradas` (`CANCELLED` / `SUPERSEDED`):** recolhida por padrão (AC-03.1); cards terminais não são arrastáveis (AC-06.8).

- **Modo Alternativo — `Kanban Unificado` (AC-03.1):**
  - Exibe as 6 colunas estritas do ciclo (`PLANNING`, `IN_PROGRESS`, `IN_REVIEW`, `READY_TO_COMMIT`, `COMMITTED`, `SHIPPED`) + raia `Bloqueadas` + área recolhível `Encerradas`, mantendo o botão `+ Nova tarefa` estilo Trello em `PLANNING` e todas as regras abaixo.

- **Anatomia do Card Kanban (`.task-card` — limpo, escaneável e sem poluição visual):**
  - **Linha 1 (Topo):** badge de prioridade (`P0`–`P3`), badge de Tier (`T2`, `T3`, `Hotfix`, `Prototype`), selo condicional (`Correção` para Bug/Hotfix; `Protótipo` para Prototype; `Level C` para destino PR/Deploy), e botão de menu `⋮` (`icon-more-vertical`, `aria-label="Ações da tarefa"`).
  - **Linha 2 (Título):** título em `--text-sm` (`font-weight: 600`, `line-height: 1.35`), máx. 2 linhas + ID mono discreto (`task-harness-hub` ou `#42` se importada do GitHub).
  - **Linha 3 (Execução ao vivo — condicional):** quando a tarefa está em execução/reivindicada, aparece a faixa compacta `.badge-running` com ponto pulsante + `Executando · <etapa>` + cronômetro `01:24` + mini-botão `Log` (abre o Console ao Vivo).
  - **Linha 4 (Rodapé):** agente responsável (`@developer` ou `Sem agente` em muted), chip de IA alvo (`claude` / `agy` / `codex` / `cursor` / `—`), progresso de ACs (`3/5` com mini-ícone check), e data agendada (`Qui 26/11` ou selo `Atrasada` se passada).

- **Regras de Drag & Drop (Intra-Quadro e Entre Quadros) + Alternativa por Teclado (AC-06.1 a AC-06.9):**
  - **Drag fluido em 3 dimensões:**
    1. *Dentro de Planejamento:* `Planejado` ↔ `Agendado` ↔ `A Corrigir` (atualiza agenda/tipo sem violar o ciclo).
    2. *Entre Quadros (`Planejamento → Execução`):* arrastar um card de `Planejado`, `Agendado` ou `A Corrigir` diretamente para **`Executar (Fila)`** (marca como pronto na fila) ou diretamente para **`Em Execução`** (valida ⓖ¹ e dispara o agente automaticamente se Auto-executar estiver ON!).
    3. *Dentro de Execução:* `Executar (Fila)` → `Em Execução` → `Em Revisão` → `Pronto` → `Feito`, sempre validado pela matriz §8.2.
  - **Feedback visual durante o arraste:**
    - Colunas permitidas destacam-se com borda tracejada azul (`--accent-text`) e fundo `--accent-soft-bg`; a coluna **`Em Execução`** exibe dica sutil `"Solte para iniciar agente"` quando Auto-executar está ON.
    - Colunas proibidas pela matriz §8.2 ficam esmaecidas (`opacity: 0.35`, `cursor: no-drop`) com rótulo `"Bloqueado pela regra"`.
    - Soltar em coluna proibida (ex.: humano arrastando para `COMMITTED`, Prototype para `Pronto`, ou `Em Revisão → Pronto` sem ACs/revisores) devolve o card com animação suave e dispara **Toast `role="alert"`** citando a regra exata (ex.: *"Somente `@committer` move para COMMITTED"*).
    - Se soltar em `Em Execução` sem agente atribuído, abre um popover rápido *"Escolha o agente e a IA para executar"* antes de disparar.
    - Soltar em `SHIPPED` / `Publicado`: abre obrigatoriamente o **Diálogo Level C (`S9`)**.
  - **Alternativa 100% por teclado (AC-06.9):**
    - Focar um card com `Tab`, abrir menu com `Enter` no botão `⋮` (ou tecla `M` com o card focado) → opção **"Mover para…"** agrupa destinos por **Planejamento** e **Execução**, indicando quais estão disponíveis e o motivo dos desabilitados (ex.: `COMMITTED — Somente @committer`).
    - Reordenação dentro da mesma coluna e mesma prioridade (AC-05.5): menu contextual `Subir na prioridade` / `Descer na prioridade` ou `Alt + ↑` / `Alt + ↓`.

---

### 2.3 `S2-GH` — GitHub Issues Inbox & Import Drawer (Novo Requisito)
**Propósito:** visualizar issues abertas do GitHub atribuídas ao usuário e trazê-las para o Backlog/Kanban em 1 clique ou por drag & drop.

- **Formas de acesso:**
  1. **Visão dedicada** na sidebar (`GitHub Inbox`) — layout em 2 colunas (lista de issues à esquerda + prévia da issue selecionada à direita).
  2. **Drawer lateral acoplável** sobre o Kanban (largura `420px`, botão `GitHub Inbox` na toolbar do Kanban) — permite arrastar uma issue diretamente da lista para a coluna `PLANNING` (cria a tarefa e a posiciona) ou clicar em `Importar para Backlog`.
- **Cabeçalho do Inbox:**
  - Filtro de repositório (dropdown `Todos os repos` / `owner/repo`), filtro por label, busca por título/número e botão `Atualizar` (`icon-refresh`).
  - Indicador de origem: badge `Conectado (@usuario)` ou badge âmbar `Modo Demo (GITHUB_TOKEN não configurado)`.
- **Card de Issue na Lista:**
  - Número em mono (`#142`), badge do repositório (`italo/workflow`), título da issue, labels coloridas com contraste AA, data de atualização relativa (`há 2h`), link externo `icon-external-link` para abrir no GitHub.
  - **Ação primária (1 clique):** botão `Importar para Backlog` (`.btn-secondary .btn-sm`) → cria `.specs/tasks/task-gh-142-<slug>.md` com status `PLANNING`, preenche `Origem: GitHub #142 (<url>)`, e altera o botão para badge verde `Importada` (com link `Ver no Kanban`, evitando duplicação acidental).
  - **Alça de arraste (`icon-grip`):** permite arrastar a issue do drawer diretamente para `PLANNING` no Kanban.
- **Estado Não Configurado / Demo (`GITHUB_TOKEN` ausente):**
  - Banner informativo claro (sem erro vermelho assustador): *"Token do GitHub não configurado (`GITHUB_TOKEN`). Exibindo issues de demonstração para teste do fluxo."*
  - Bloco colapsável com instrução de 1 linha em mono (`$env:GITHUB_TOKEN="ghp_..."`) + botão `Testar conexão novamente`.
  - Mantém 3–4 issues de demonstração realistas interativas (podem ser pré-visualizadas e importadas em modo local) com selo discreto `Demo` para não bloquear avaliação do fluxo.
- **Estados Empty / Loading / Error:**
  - *Loading:* 4 skeleton cards.
  - *Empty (conectado, 0 issues):* *"Nenhuma issue aberta atribuída a você nos repositórios monitorados."* + botão `Atualizar`.
  - *Error (rate limit / rede offline):* causa exata + botão `Tentar novamente`.

---

### 2.4 `S-EXEC` — Console de Execução ao Vivo & Feedback de Auto-Run (Novo Requisito)
**Propósito:** transparência total em tempo real quando um card é arrastado para `IN_PROGRESS` (ou disparado manualmente), com controle de parada segura.

- **Localização:** Dock inferior fixo na área de conteúdo (acima da borda inferior), presente em todas as telas para que o usuário navegue sem perder visibilidade do run ativo.
- **3 estados de altura:**
  1. **Colapsado (`40px`):** barra de telemetria compacta mostrando:
     - Ponto pulsante `--status-running-text` + `Executando: task-auth-fix` + `@developer · claude`
     - Etapa atual em destaque (`3/4 Executando`) + cronômetro tabular (`01:42`)
     - Botão `Parar` (`.btn-danger .btn-sm`, `icon-stop`) + botão `Expandir console` (`icon-chevron-down` invertido).
     - Se não houver run ativo: barra discreta `Console de Execução · Ocioso` + seletor de execuções recentes.
  2. **Expandido (`260px`, padrão ao disparar):**
     - **Cabeçalho + Seletor de Run:** abas horizontais se houver múltiplos agentes executando em paralelo em slices disjuntos (ex.: `@developer · task-a` | `@qa-engineer · task-b`), com contador de status.
     - **Stepper de 4 Etapas do Pipeline (horizontal, sempre visível no topo do console):**
       1. `1. Amplificando Prompt` (mostra a linha `Amplified: ... · proof: ...` em tooltip/resumo ao concluir)
       2. `2. Decompondo` (slices / arquivos em escopo)
       3. `3. Executando` (agente + IA + modelo ativo)
       4. `4. Gate` (validação determinística `validate-task` / `gate.mjs`)
       - Cada etapa tem 4 estados visuais: *pendente* (cinza), *em curso* (teal pulsante), *concluída* (`icon-check-circle` verde), *falha* (`icon-x-circle` coral).
     - **Barra de ferramentas do log:** busca de texto em tempo real, filtros de nível (`Todos`, `Stdout`, `Stderr`, `Gate`), toggle `Seguir fim` (pausa automaticamente ao rolar para cima, retoma ao clicar `Ir ao fim`), botão `Copiar log` e botão **`Parar execução`** (`.btn-danger` — pede confirmação inline rápida `"Confirmar parada?"` ou clique duplo seguro para evitar clique acidental, encerrando a árvore de processos cross-platform).
     - **Stream de Logs (`<pre role="log" aria-live="off">`):** fonte `--font-mono`, `12.5px`, fundo `--bg-inset`, timestamps à esquerda em cor suave, destaque colorido por prefixo (`[AMPLIFY]`, `[STEP]`, `[GATE PASS]`, `[ERROR]`).
  3. **Maximizado (`55vh`):** para depuração detalhada de logs longos.
- **Estados do Console:**
  - *Running:* ponto pulsante, botão `Parar execução` habilitado.
  - *Stopping:* botão muda para `Encerrando…` (disabled + spinner).
  - *Completed:* faixa verde discreta `Concluído em 02:18 · Gate PASS` + CTA `Mover para IN_REVIEW` (se aplicável).
  - *Failed / Stopped:* faixa coral `Interrompido / Falhou (exit 1)` + botão `Tentar novamente`.

---

### 2.5 `S3` — Drawer de Detalhes da Tarefa & `S4` — Modal Nova Tarefa
- **`S3` Drawer Lateral (`520px`, `Esc` fecha):**
  - **Cabeçalho sticky:** ID mono (`task-harness-hub`), badge de Status atual, botão `Mover para…` (menu com matriz §8.2), botão `Abrir no editor` (revela/copia caminho do arquivo, AC-08.5) e botão fechar `×`.
  - **Grade de Metadados Editáveis (2 colunas, persistência imediata com feedback inline `Salvo`):**
    - `Prioridade` (`P0`–`P3`), `Tier` (`T2`, `T3`, `Hotfix`, `Prototype` — inclui botão `Promover para T2/T3` se Prototype, AC-05.8), `Tipo` (`Feature`, `Bug`, `Hotfix`, `Prototype`, `Docs`, `Ops`, `Harness`), `Agente responsável` (lista dinâmica do roster excluindo read-only e `@committer`, AC-05.4 / §8.5), `Revisor` (recusa mesmo agente que autor em T2+ com erro inline, AC-05.3), `IA alvo`, checkboxes `Superfície sensível` e `Voltada ao usuário` (§8.3).
  - **Seções do Arquivo Markdown (AC-08.2):**
    - *Origem & Prova*, *Problema*, *Critérios de Aceite (ACs)* (checkbox interativo; marcar exige campo de evidência preenchido — se vazio, foco no input de evidência com erro `"Evidência obrigatória"`, AC-08.3), *Revisores Obrigatórios do Tier* (checklist com status Pendente / Aprovado, AC-08.4), *Fora de escopo*, *Arquivos & Slices*, *Decisões tomadas*, *Needs from user* (destacado em card âmbar quando preenchido), e *Log de histórico* (somente leitura).
  - **Ações de Ciclo no Rodapé:** `Bloquear` (abre mini-formulário exigindo motivo + toggle `Decisão do usuário: Sim/Não`, AC-07.1), `Superseder` (seletor de outra tarefa, bloqueando a própria, AC-07.4), `Cancelar` (pede confirmação, AC-07.3).
  - **Conflito Externo (`S10`, AC-08.6 / AC-16.2):** se o arquivo mudar no disco com edição local pendente, barra âmbar no topo do drawer + modal `S10` *"Arquivo alterado fora do Hub"* com botões `Recarregar (descartar minha edição)` e `Ver diferença` (diff lado a lado).
- **`S4` Modal Nova Tarefa (`560px`):**
  - Campos da AC-04.1: Título (obrigatório; erro inline `"Título obrigatório"`), Problema (textarea), Critérios de Aceite (lista dinâmica com `+ Adicionar AC`; obrigatório `>= 1` para T2/T3/Hotfix), Fora de escopo, Tier (padrão `T2`), Tipo (padrão `Feature`), Prioridade (padrão `P2`), Agente responsável (opcional), Revisor (opcional), Origem.
  - Rodapé: `Cancelar` + `Criar tarefa` (`.btn-primary`).

---

### 2.6 `S5` — Fila de Demanda
**Propósito:** mostrar exatamente o que cada agente vai reivindicar a seguir, em ordem determinística (AC-09.2).

- **Toolbar:** filtro por agente (`Todos os agentes` ou chips dos agentes com itens na fila), filtro por tipo de demanda (`Todos`, `Construir`, `Revisar`, `Comitar`) e legenda compacta da regra de ordenação (`Prioridade P0→P3 · Hoje primeiro · Ordem manual · Mais antiga`).
- **Seção 1 — Elegíveis (Tabela/Lista estruturada):**
  - Colunas: Posição (`#1` + badge verde **`Próximo`** no topo de cada agente, AC-09.6), Tipo (`Construir` azul / `Revisar` âmbar / `Comitar` verde com `icon-lock`), Tarefa (título + P0–P3 + Tier), Destinatário (`@agente`), IA alvo / Agenda (`Hoje`, `Sem agenda`), Ação rápida (`Ver tarefa` ou `Executar agora`).
- **Seção 2 — Não Elegíveis (Seção separada recolhível, aberta por padrão quando `> 0`, AC-09.4):**
  - Lista cada item bloqueado/inelegível com pílula de motivo exato em coral/âmbar: `"Sem agente atribuído"`, `"Conflito de arquivos com task-x"`, `"Agendado para quinta"`, `"Validador reprovou"`.
- **Estado Vazio:** *"Fila vazia — nenhuma tarefa elegível no momento"* + CTA `Ir para o Kanban`.

---

### 2.7 `S6` — Agenda Semanal
**Propósito:** planejar a semana (Seg–Dom) atribuindo tarefas a dias, agentes, IAs e destinos.

- **Cabeçalho:** controles `< Semana anterior` · `Hoje` · `Próxima semana >` + rótulo do intervalo (`23 Nov – 29 Nov 2026`).
- **Layout 2 Zonas:**
  - **Barra Lateral Esquerda (`240px`, recolhível em `<= 1024px`) — "Não agendadas":** lista de tarefas não terminais sem data, com campo de busca rápido. Cada item é arrastável para qualquer coluna de dia (ou agendável via botão `Agendar…` por teclado).
  - **Grade 7 Colunas (`Seg` a `Dom`, AC-11.1):**
    - Cabeçalho do dia com dia da semana + data tabular (`Seg 23`). A coluna de **Hoje** tem destaque sutil (`border-top: 2px solid --accent-text` + badge `Hoje`).
    - **Bloco de Agendamento (Card compacto):** título, prioridade (`P0`–`P3`), `@agente`, badge de IA alvo (se a IA estiver `"Não instalada"`, exibe ícone `icon-alert-triangle` + aviso `"IA não detectada nesta máquina"`, AC-11.6), badge de **Destino** (`Working tree local`, `Commit local`, `Pull Request`, `Deploy`).
    - **Selo Level C obrigatório (AC-11.5):** destinos `Pull Request` e `Deploy` exibem pílula âmbar `Requer aprovação (Level C)` no bloco da agenda e no card do Kanban.
    - **Selo de Estado:** `Atrasada` (coral, dia passado + tarefa não concluída, AC-11.8) ou `Concluída` (verde, `COMMITTED`/`SHIPPED`, AC-11.9).
- **Popover/Modal de Edição de Agendamento:** ao soltar ou clicar num bloco, permite ajustar Dia, Agente (padrão = responsável da tarefa), IA alvo, Destino, Observação opcional e botão `Remover agendamento`.

---

### 2.8 `S7` — Monitor de Agentes & Incidentes
**Propósito:** acompanhar os 14 agentes do roster (lidos dinamicamente de `AGENTS.md`) e incidentes abertos do harness.

- **Abas internas ou divisão em 2 seções claras:**
  1. **Roster de Agentes (14 cards em grid responsivo: 4 colunas em 1440px, 3 em 1024px, 2 em 768px, 1 em 390px):**
     - **Cabeçalho do Card:** `@nome-do-agente` em mono bold + pílula de estado: **Ativo** (teal pulsante), **Bloqueado** (coral), **Idle** (cinza).
     - **Corpo:** papel resumido, modelo declarado (`inherit`, `sonnet`, `haiku`), selos de governança de `AGENTS.md` (AC-12.6):
       - `@explorer` → badge `Somente leitura`
       - `@code-reviewer`, `@security-auditor` → badge `Não altera código (só relatórios)`
       - `@committer` → badge `Único que comita` (`icon-lock`)
     - **Atividade Atual (quando Ativo/Bloqueado):** tarefa atual clicável, IA em uso e tempo decorrido (`00:48`).
     - **Rodapé:** contadores tabulares `Na fila: N` e `Agendado: M`. Clicar no card abre o **Drawer de Histórico do Agente** (últimas 20 ações, AC-12.5).
  2. **Painel "Incidentes do Harness" (HU-13, somente leitura):**
     - Cabeçalho com contadores: `Abertos: N` (coral se `> 0`) e `Corrigidos: M` (verde).
     - Tabela compacta dos incidentes abertos: Data (mono), Chave, Camada, Descrição e Local (caminho mono).

---

### 2.9 `S8` — Hub Multi-AI (Paridade, Drift & Prompt Amplifier)
**Propósito:** garantir paridade de regras, agentes e skills entre **Antigravity, Claude Code, Codex e Cursor**, com sincronização segura e prévia da regra canônica do Prompt Amplifier.

- **Cabeçalho da Visão:** resumo global (`K/4 plataformas em paridade`) + botão primário **`Sincronizar todas`** (`icon-refresh`, AC-15.1) + botão secundário `Reverificar CLIs`.
- **Grade de 4 Cards de Plataforma (2×2 em desktop, 1 coluna em mobile):**
  - **Antigravity (`agy`)**, **Claude Code (`claude`)**, **Codex (`codex`)**, **Cursor (`agent`)**.
  - Cada card contém:
    - Nome da plataforma + detecção local: badge verde `Instalada (vX.Y.Z)` ou badge neutro `Não instalada` (AC-14.2).
    - **Status de Paridade:**
      - `Em paridade` (verde — ou `Em paridade — fonte canônica` para Claude Code, AC-14.7)
      - `Drift (N)` (âmbar — N itens divergentes/ausentes/órfãos)
      - `Não gerado` (neutro — nenhuma projeção existe)
    - Caminhos projetados em mono (ex.: `.agents/skills/`, `.cursor/rules/*.mdc`).
    - Ações: botão `Sincronizar` (abre prévia de criar/atualizar/remover; se sobrescrever edição manual, exige **Diálogo Level C `S9`**, AC-15.3) e botão `Ver divergências` (abre modal/drawer de comparação lado a lado Canônico × Projeção, AC-14.6).
- **Painel Destacado — Prévia da Regra Canônica: Prompt Amplifier (`80-prompt-amplifier.md`):**
  - Card editorial-técnico abaixo dos 4 cards mostrando a regra canônica que é projetada identicamente para todas as 4 IAs (com selo `Fonte canônica: .claude/rules/80-prompt-amplifier.md` e status `Sincronizado em K/4 IAs`).
  - Exibe visualmente as **4 etapas do passe interno** em 4 mini-blocos numerados (1 linha de 4 colunas em desktop):
    1. **`01 · Unasked expertise`** — *O que um especialista de topo faria aqui que não foi pedido?*
    2. **`02 · Rawest material`** — *Qual fonte primária ler primeiro? (código rodando, logs reais, erro real, schema)*
    3. **`03 · Methods and tools`** — *Quais técnicas e ferramentas nomeadas aplicar?*
    4. **`04 · External proof`** — *O que, além do Maestro ou do usuário, prova o resultado?*
  - Rodapé do painel exibe o formato canônico de saída em bloco mono:
    `Amplified: <tarefa reescrita> · proof: <oráculo>`
    e a regra-chave *"Deeper, not bigger — aguça método, fontes e prova sem inflar escopo."*

---

## 3. Matriz Completa de Estados da Interface

| Estado | Onde ocorre | Representação Visual & Comportamento |
|---|---|---|
| **Empty** | Mission Control (0 tarefas), Kanban (coluna vazia), GitHub Inbox (0 issues), Fila vazia, Agenda vazia, Multi-AI não gerado | Ilustração/ícone SVG `28px` em `--text-muted`, mensagem específica em pt-BR e 1 CTA primário contextual. Coluna vazia no Kanban mantém zona de drop visível (`min-height: 120px`, borda tracejada sutil). |
| **Loading** | Carga inicial, Gate rodando, detecção de CLIs, fetch do GitHub, sincronização | Skeleton local na região afetada; sidebar e demais visões permanecem navegáveis; botão gatilho recebe spinner e `disabled`. |
| **Error** | Arquivo de tarefa corrompido (card `Inválido`), Gate `FAIL`, timeout de 5 min, falha de escrita, erro de API GitHub | Card/alerta com borda `--status-danger-border`, mensagem com causa + caminho/comando em mono, últimas 50 linhas de log em `FAIL` e botão `Tentar novamente`. |
| **Blocked** | Tarefa `BLOCKED(<prev>)`, agente bloqueado, transição proibida na matriz §8.2 | Raia/selo coral com `estava em <prev>` e motivo literal; em drag proibido, coluna esmaece + toast `role="alert"` citando a regra violada. |
| **Running** | Card em execução (auto-run ou reivindicado), Gate rodando, Sync rodando | Badge `.badge-running` com ponto teal pulsante + cronômetro tabular + barra de progresso `2px` no topo do card + Console ao Vivo ativo com botão `Parar`. |
| **Scheduled** | Card com data na Agenda Semanal | Chip de data no card Kanban (`Qui 26/11`); se futuro, aparece em `Não elegíveis` na Fila (`Agendado para quinta`); se passado e aberto, selo coral `Atrasada`. |
| **Disconnected** | Perda de SSE / file watcher (`HU-16`) | Pílula da topbar muda para `Desconectado` + banner persistente no topo + todos os controles de escrita/drag ficam `disabled` até reconectar. |
| **Conflict** | Edição externa de arquivo com alterações locais abertas (`S10`) | Modal bloqueante com opções `Recarregar (descartar minha edição)` e `Ver diferença`; nenhuma sobrescrita silenciosa. |
| **Unconfigured / Demo** | GitHub Inbox sem `GITHUB_TOKEN` | Banner informativo âmbar + comando de setup em mono + 3–4 issues demo rotuladas `Demo` para testar o fluxo de importação. |
| **Conteúdo Longo** | Títulos extensos, 50+ linhas de log, 200 tarefas | Títulos truncados em 2 linhas com `title`; logs em container rolável virtual/sticky com auto-follow; colunas do Kanban com scroll vertical independente. |

---

## 4. Comportamento Responsivo (`1440 / 1024 / 768 / 390px`)

| Breakpoint | Shell (Sidebar & Topbar) | Mission Control | Kanban & Drawers | Agenda / Agentes / Multi-AI |
|---|---|---|---|---|
| **1440px (Desktop Largo)** | Sidebar fixa `236px` expandida; topbar completa com busca `Ctrl+K` visível; Console dock na largura do conteúdo. | 6 KPIs em 1 linha; grid principal `7fr / 5fr`. | Dois Quadros empilhados com respiro (`24px` entre quadros): Quadro 1 (3 colunas cheias `1fr`) + Quadro 2 (5 colunas em scroll horizontal suave); Drawers (`520px` tarefa / `420px` GitHub) sobrepõem à direita sem espremer colunas. | Agenda: barra não agendadas `240px` + 7 colunas; Agentes: 4 colunas; Multi-AI: 2×2 + Prompt Amplifier em 4 colunas. |
| **1024px (Laptop)** | Sidebar colapsável (`64px` ícones + tooltips, expansível via botão); topbar mantém busca compacta e SSE pill. | KPIs em grid `3×2`; grid principal `1fr / 1fr`. | Quadro 1 (3 colunas `min-width: 260px`) + Quadro 2 (5 colunas `270px` com scroll horizontal + indicadores de rolagem); Drawer `480px`. | Agenda: barra não agendadas vira drawer/acordeão superior + 7 colunas compactas; Agentes: 3 colunas; Multi-AI: 2×2. |
| **768px (Tablet)** | Sidebar vira drawer deslizante (`icon-menu` na topbar); busca vira botão ícone `Ctrl+K`; toggle Auto-executar fica na toolbar do Kanban. | KPIs em `2×3`; grid principal empilhado (`1fr`). | Abas rápidas `Planejamento` / `Execução` (ou scroll horizontal com `scroll-snap-type: x proximity` por coluna); Drawer ocupa `85vw`. | Agenda: grade com scroll horizontal (`min-width: 140px/dia`); Agentes: 2 colunas; Multi-AI: 2 colunas + Prompt Amplifier `2×2`. |
| **390px (Mobile / Janela Estreita)** | Sidebar em drawer full-height; topbar compacta (Menu + Título + SSE dot + `+`); Console ao Vivo abre como sheet inferior (`60vh` expandido). | KPIs em `2×3` compactos; distribuição do ciclo em chips roláveis; cards empilhados. | Seletor de quadro (`Planejamento` / `Execução`) + **abas horizontais de coluna** (1 coluna visível por vez) + `+ Nova tarefa` rápido no topo + ação `Mover para…` sempre acessível no card; Drawer full-screen (`100vw`). | Agenda: visualização por dia (abas Seg–Dom); Agentes: 1 coluna; Multi-AI: 1 coluna + Prompt Amplifier empilhado. |
