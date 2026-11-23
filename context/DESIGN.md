# DESIGN.md — Sistema de Design do Harness Hub

**Versão:** 1.0  
**Data:** 2026-11-23  
**Autor:** `@designer`  
**Idioma da UI:** Português do Brasil (`pt-BR`)  
**Stack alvo:** HTML5 semântico + CSS3 nativo (Custom Properties) + JS ESM vanilla — zero build step, 100% offline-ready.

---

## 1. Direção Estética e Princípios

O **Harness Hub** é um painel de **Mission Control editorial-técnico** para coordenação de 14 agentes em 4 plataformas de IA. Ele foi projetado para superar radicalmente a estética "TUI portada para HTML" do `devworks-harness` (que usava `ui-monospace` no corpo inteiro, azul-marinho saturado `#06111d`, `border-radius: 0`, títulos gigantes centralizados e tudo empilhado em uma única coluna vertical).

### Princípios inegociáveis
1. **Densidade legível, não terminal cru:** Tipografia *sans-serif* geométrica do sistema para navegação, títulos e conteúdo; *monospace* reservado exclusivamente para IDs de tarefa, caminhos de arquivo, comandos, timestamps, diffs e streams de log.
2. **Dark-first em grafite neutro (com Light Mode calibrado):** Superfícies em grafite/ardósia neutra (`#0B0D10` → `#12151B` → `#181D25`) com bordas hairline (`1px`), sem gradientes roxos genéricos e sem fundos azuis saturados que causam fadiga em sessões longas.
3. **Semântica nunca depende apenas de cor:** Todo status do ciclo de vida, prioridade, alerta Level C ou estado de execução combina **ícone SVG + rótulo textual curto + token de cor**.
4. **Zero emojis como ícones de UI:** Todos os ícones são SVGs inline `stroke-width: 1.75`, alinhados em grade `16×16` ou `20×20` (`aria-hidden="true"` quando decorativos).
5. **Acessibilidade por construção:** Contraste mínimo **WCAG 2.1 AA** (`>= 4.5:1` texto normal, `>= 3:1` ícones/bordas interativas), foco visível consistente (`:focus-visible`), navegação completa por teclado e suporte a `prefers-reduced-motion`.

---

## 2. Tokens CSS Prontos para Colar (`tokens.css`)

O tema padrão é `dark` (definido em `:root` e `[data-theme="dark"]`). A alternância para tema claro aplica `data-theme="light"` no elemento `<html>` e persiste em `localStorage.getItem('harness-hub-theme')`.

```css
/* ==========================================================================
   Harness Hub — Design Tokens (Dark-First + Light Theme)
   WCAG 2.1 AA verificado em todos os pares texto/superfície (>= 4.5:1)
   ========================================================================== */

:root,
[data-theme="dark"] {
  color-scheme: dark;

  /* --- Superfícies (Grafite Neutro) --- */
  --bg-canvas: #0B0D10;          /* Fundo global da aplicação */
  --bg-sidebar: #0F1217;         /* Navegação lateral fixa */
  --bg-surface: #12151B;         /* Cards, painéis, colunas */
  --bg-elevated: #181D25;        /* Cards em hover, modais, drawers, dropdowns */
  --bg-subtle: #1E242E;          /* Chips neutros, trilhas de progresso, header de tabela */
  --bg-inset: #080A0D;           /* Console de logs, blocos de código/diff */
  --bg-overlay: rgba(5, 7, 10, 0.72);

  /* --- Bordas --- */
  --border-subtle: #202631;      /* Divisórias internas e linhas de tabela */
  --border-default: #2B3342;     /* Bordas de cards, inputs e botões secundários */
  --border-strong: #3E4A5E;      /* Hover de inputs, separadores de destaque */
  --border-focus: #60A5FA;       /* Anel de foco acessível */

  /* --- Tipografia --- */
  --text-primary: #F1F5F9;       /* 16.1:1 sobre --bg-surface (AAA) */
  --text-secondary: #A3B1C2;     /*  8.2:1 sobre --bg-surface (AAA) */
  --text-muted: #8594A6;         /*  5.3:1 sobre --bg-elevated (AA+) */
  --text-inverse: #FFFFFF;       /* Texto sobre botões sólidos */

  /* --- Acento Principal (Azul Cobalto Técnico) --- */
  --accent-solid: #2563EB;       /* Botão primário (#FFFFFF sobre #2563EB = 5.49:1 AA) */
  --accent-solid-hover: #1D4ED8;
  --accent-text: #60A5FA;        /* Links e destaques (6.9:1 sobre --bg-surface) */
  --accent-soft-bg: rgba(59, 130, 246, 0.14);
  --accent-soft-border: rgba(96, 165, 250, 0.34);

  /* --- Semântica de Status / Gates / Operação --- */
  --status-pass-text: #34D399;   /*  9.9:1 sobre --bg-surface */
  --status-pass-bg: rgba(16, 185, 129, 0.14);
  --status-pass-border: rgba(52, 211, 153, 0.34);

  --status-running-text: #2DD4BF;/* 10.1:1 sobre --bg-surface */
  --status-running-bg: rgba(20, 184, 166, 0.14);
  --status-running-border: rgba(45, 212, 191, 0.38);

  --status-warn-text: #FBBF24;   /* 10.3:1 sobre --bg-surface */
  --status-warn-bg: rgba(245, 158, 11, 0.14);
  --status-warn-border: rgba(251, 191, 36, 0.36);

  --status-danger-text: #F87171; /*  5.9:1 sobre --bg-surface */
  --status-danger-bg: rgba(239, 68, 68, 0.14);
  --status-danger-border: rgba(248, 113, 113, 0.36);
  --danger-solid: #DC2626;       /* #FFFFFF sobre #DC2626 = 4.88:1 AA */
  --danger-solid-hover: #B91C1C;

  --status-info-text: #7DD3FC;   /* 11.2:1 sobre --bg-surface */
  --status-info-bg: rgba(14, 165, 233, 0.14);
  --status-info-border: rgba(125, 211, 252, 0.34);

  --status-neutral-text: #94A3B8;/*  6.6:1 sobre --bg-surface */
  --status-neutral-bg: rgba(148, 163, 184, 0.12);
  --status-neutral-border: rgba(148, 163, 184, 0.28);

  /* --- Ciclo de Vida do Harness (Kanban & Badges) --- */
  --life-planning: #94A3B8;      /* Ardósia */
  --life-in-progress: #2DD4BF;   /* Teal ativo */
  --life-in-review: #FBBF24;     /* Âmbar revisão */
  --life-ready: #60A5FA;         /* Azul pronto para commit */
  --life-committed: #34D399;     /* Esmeralda */
  --life-shipped: #10B981;       /* Esmeralda profundo */
  --life-blocked: #F87171;       /* Coral bloqueado */
  --life-terminal: #64748B;      /* Cancelada / Supersedida */

  /* --- Prioridades (P0–P3) --- */
  --prio-p0-text: #FCA5A5;
  --prio-p0-bg: rgba(220, 38, 38, 0.22);
  --prio-p0-border: rgba(248, 113, 113, 0.45);

  --prio-p1-text: #FCD34D;
  --prio-p1-bg: rgba(217, 119, 6, 0.20);
  --prio-p1-border: rgba(251, 191, 36, 0.42);

  --prio-p2-text: #93C5FD;
  --prio-p2-bg: rgba(37, 99, 235, 0.18);
  --prio-p2-border: rgba(96, 165, 250, 0.38);

  --prio-p3-text: #94A3B8;
  --prio-p3-bg: rgba(100, 116, 139, 0.16);
  --prio-p3-border: rgba(148, 163, 184, 0.30);

  /* --- Sombra e Elevação --- */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
  --shadow-md: 0 6px 20px rgba(0, 0, 0, 0.42);
  --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.56);
  --focus-ring: 0 0 0 2px var(--bg-canvas), 0 0 0 4px var(--border-focus);

  /* --- Tipografia (Offline-Ready System Stack) --- */
  --font-sans: 'Segoe UI Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: 'Cascadia Mono', 'Cascadia Code', ui-monospace, 'SFMono-Regular', Consolas, monospace;

  --text-xs: 0.75rem;            /* 12px — badges, metadados, labels de coluna */
  --text-sm: 0.8125rem;          /* 13px — corpo denso, tabelas, cards Kanban */
  --text-base: 0.875rem;         /* 14px — corpo padrão, formulários, drawer */
  --text-md: 1rem;               /* 16px — títulos de card e subseções */
  --text-lg: 1.25rem;            /* 20px — título de página */
  --text-xl: 1.75rem;            /* 28px — números KPI principais */

  --leading-tight: 1.25;
  --leading-normal: 1.45;
  --leading-relaxed: 1.6;

  /* --- Espaçamento (Escala 4px) --- */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* --- Raios de Borda --- */
  --radius-sm: 4px;              /* Badges quadrados, code tags, teclas kbd */
  --radius-md: 8px;              /* Botões, inputs, cards Kanban */
  --radius-lg: 12px;             /* Painéis, KPI cards, modais */
  --radius-pill: 9999px;         /* Status pills, contadores, toggles */

  /* --- Dimensões do Shell --- */
  --sidebar-width: 236px;
  --sidebar-collapsed: 64px;
  --topbar-height: 54px;
  --drawer-width: 520px;
  --console-height: 260px;

  /* --- Z-index --- */
  --z-sticky: 20;
  --z-topbar: 30;
  --z-sidebar: 40;
  --z-console: 45;
  --z-drawer: 60;
  --z-modal: 80;
  --z-palette: 90;
  --z-toast: 100;

  /* --- Movimento --- */
  --dur-fast: 120ms;
  --dur-base: 180ms;
  --dur-slow: 260ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

[data-theme="light"] {
  color-scheme: light;

  /* --- Superfícies (Papel Técnico Claro) --- */
  --bg-canvas: #F5F7FA;
  --bg-sidebar: #EEF2F6;
  --bg-surface: #FFFFFF;
  --bg-elevated: #F8FAFC;
  --bg-subtle: #E9EEF5;
  --bg-inset: #0F172A;           /* Console de logs permanece escuro p/ legibilidade técnica */
  --bg-overlay: rgba(15, 23, 42, 0.45);

  /* --- Bordas --- */
  --border-subtle: #E2E8F0;
  --border-default: #CBD5E1;
  --border-strong: #94A3B8;
  --border-focus: #1D4ED8;

  /* --- Tipografia --- */
  --text-primary: #0F172A;       /* 17.8:1 sobre #FFFFFF (AAA) */
  --text-secondary: #334155;     /* 10.3:1 sobre #FFFFFF (AAA) */
  --text-muted: #526071;         /*  6.3:1 sobre #FFFFFF / 5.5:1 sobre #EDF1F6 (AA+) */
  --text-inverse: #FFFFFF;

  /* --- Acento Principal --- */
  --accent-solid: #1D4ED8;       /* 6.7:1 com #FFFFFF */
  --accent-solid-hover: #1E40AF;
  --accent-text: #1D4ED8;        /* 6.7:1 sobre #FFFFFF */
  --accent-soft-bg: #EFF6FF;
  --accent-soft-border: #BFDBFE;

  /* --- Semântica --- */
  --status-pass-text: #047857;   /* 5.4:1 sobre #FFFFFF */
  --status-pass-bg: #ECFDF5;
  --status-pass-border: #A7F3D0;

  --status-running-text: #0F766E;/* 5.4:1 sobre #FFFFFF / 4.9:1 sobre #CCFBF1 */
  --status-running-bg: #F0FDFA;
  --status-running-border: #99F6E4;

  --status-warn-text: #92400E;   /* 7.1:1 sobre #FFFFFF / 6.3:1 sobre #FEF3C7 */
  --status-warn-bg: #FFFBEB;
  --status-warn-border: #FDE68A;

  --status-danger-text: #B91C1C; /* 6.5:1 sobre #FFFFFF / 5.4:1 sobre #FEE2E2 */
  --status-danger-bg: #FEF2F2;
  --status-danger-border: #FECACA;
  --danger-solid: #B91C1C;       /* 6.5:1 com #FFFFFF */
  --danger-solid-hover: #991B1B;

  --status-info-text: #0369A1;   /* 5.9:1 sobre #FFFFFF */
  --status-info-bg: #F0F9FF;
  --status-info-border: #BAE6FD;

  --status-neutral-text: #475569;/* 7.5:1 sobre #FFFFFF */
  --status-neutral-bg: #F1F5F9;
  --status-neutral-border: #CBD5E1;

  /* --- Ciclo de Vida --- */
  --life-planning: #475569;
  --life-in-progress: #0F766E;
  --life-in-review: #92400E;
  --life-ready: #1D4ED8;
  --life-committed: #047857;
  --life-shipped: #065F46;
  --life-blocked: #B91C1C;
  --life-terminal: #64748B;

  /* --- Prioridades --- */
  --prio-p0-text: #991B1B;
  --prio-p0-bg: #FEE2E2;
  --prio-p0-border: #FCA5A5;

  --prio-p1-text: #92400E;
  --prio-p1-bg: #FEF3C7;
  --prio-p1-border: #FCD34D;

  --prio-p2-text: #1E40AF;
  --prio-p2-bg: #DBEAFE;
  --prio-p2-border: #93C5FD;

  --prio-p3-text: #475569;
  --prio-p3-bg: #F1F5F9;
  --prio-p3-border: #CBD5E1;

  /* --- Sombras --- */
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 6px 18px rgba(15, 23, 42, 0.09);
  --shadow-lg: 0 16px 36px rgba(15, 23, 42, 0.14);
}

/* --- Reduced Motion (Acessibilidade) --- */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 3. Tabela de Contraste e Semântica de Status

| Elemento | Dark (`fg` / `bg`) | Contraste Dark | Light (`fg` / `bg`) | Contraste Light | Ícone SVG + Texto |
|---|---|---|---|---|---|
| Texto primário | `#F1F5F9` / `#12151B` | `16.1:1` (AAA) | `#0F172A` / `#FFFFFF` | `17.8:1` (AAA) | — |
| Texto secundário | `#A3B1C2` / `#12151B` | `8.2:1` (AAA) | `#334155` / `#FFFFFF` | `10.3:1` (AAA) | — |
| Texto auxiliar (`muted`) | `#8594A6` / `#181D25` | `5.3:1` (AA+) | `#526071` / `#EDF1F6` | `5.5:1` (AA+) | — |
| Botão primário | `#FFFFFF` / `#2563EB` | `5.49:1` (AA) | `#FFFFFF` / `#1D4ED8` | `6.7:1` (AA+) | Rótulo explícito |
| Botão destrutivo / Stop | `#FFFFFF` / `#DC2626` | `4.88:1` (AA) | `#FFFFFF` / `#B91C1C` | `6.5:1` (AA+) | `icon-stop` + texto |
| Status `PASS` / `COMMITTED` | `#34D399` / `#12151B` | `9.9:1` (AAA) | `#047857` / `#ECFDF5` | `5.1:1` (AA) | `icon-check-circle` + `PASS` |
| Status `Executando` / SSE Vivo | `#2DD4BF` / `#12151B` | `10.1:1` (AAA) | `#0F766E` / `#F0FDFA` | `5.2:1` (AA) | Pulso SVG + `Executando` |
| Status `Drift` / `Level C` / `IN_REVIEW` | `#FBBF24` / `#12151B` | `10.3:1` (AAA) | `#92400E` / `#FFFBEB` | `6.8:1` (AA+) | `icon-alert-triangle` + rótulo |
| Status `FAIL` / `BLOCKED` / `P0` | `#F87171` / `#12151B` | `5.9:1` (AA+) | `#B91C1C` / `#FEF2F2` | `6.0:1` (AA+) | `icon-ban` ou `icon-x-circle` |

---

## 4. Tipografia e Regras de Uso

- **Escala estrita:** nunca usar tamanhos arbitrários fora dos 6 tokens (`--text-xs` a `--text-xl`).
- **Tabular numbers obrigatórios:** aplicar `font-variant-numeric: tabular-nums;` em:
  - KPIs do Mission Control
  - Contadores de coluna do Kanban (`N` ou `N de M`)
  - Cronômetros de execução (`00:14`, `01:32`)
  - Datas da Agenda Semanal e timestamps do console de logs.
- **Uso de `--font-mono`:** exclusivamente para `task-<slug>`, caminhos `.specs/tasks/...`, comandos de gate (`node scripts/gate.mjs`), `#123` de issue GitHub, timestamps `18:42:09`, hashes de commit e linhas do console de execução.
- **Truncamento controlado:** títulos de cards Kanban usam `-webkit-line-clamp: 2` com `title` nativo no elemento; caminhos de arquivo longos usam `overflow: hidden; text-overflow: ellipsis; direction: rtl` ou quebra em `/` para preservar o nome do arquivo no final.

---

## 5. Inventário de Ícones SVG Inline (Zero Emojis)

Todos os ícones usam `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, em `16px` (badges/botões/tabela) ou `18px` (navegação lateral).

| ID do Ícone | Uso na Interface |
|---|---|
| `icon-radar` | Menu: Mission Control |
| `icon-columns` | Menu: Kanban & Backlog |
| `icon-list-ordered` | Menu: Fila de Demanda |
| `icon-calendar` | Menu: Agenda Semanal |
| `icon-users` | Menu: Monitor de Agentes |
| `icon-cpu` | Menu: Hub Multi-AI |
| `icon-github` | Aba/Drawer: GitHub Issues Inbox |
| `icon-terminal` | Drawer colapsável: Console de Execução ao Vivo |
| `icon-search` | Botão/atalho Command Palette (`Ctrl+K`) e filtros |
| `icon-plus` | Ação "Nova tarefa" |
| `icon-play` | Rodar gate / iniciar execução |
| `icon-stop` | Botão Stop seguro na execução ao vivo |
| `icon-refresh` | Sincronizar Multi-AI / atualizar GitHub Inbox |
| `icon-check-circle` | Gate `PASS`, Em paridade, AC concluído |
| `icon-x-circle` | Gate `FAIL`, erro de validação |
| `icon-alert-triangle` | Aviso Level C, Drift, conflito de arquivo |
| `icon-ban` | Tarefa `BLOCKED`, transição proibida |
| `icon-lock` | Exclusivo `@committer` (`COMMITTED`), ação protegida |
| `icon-git-commit` | Status `READY_TO_COMMIT` / `COMMITTED` |
| `icon-rocket` | Status `SHIPPED` / destino Deploy |
| `icon-bug` | Selo "Correção" (Bug/Hotfix) |
| `icon-flask` | Selo "Protótipo" (Prototype) |
| `icon-grip` | Alça de drag & drop (visual + teclado) |
| `icon-more-vertical` | Menu contextual do card ("Mover para…", Bloquear, Cancelar) |
| `icon-sun` / `icon-moon` | Toggle de tema Claro / Escuro |
| `icon-chevron-down` / `icon-x` | Acordeões, fechar drawers/modais |
| `icon-external-link` | Abrir issue no GitHub / revelar caminho no editor |
| `icon-sparkles-off` → `icon-sliders` | Prompt Amplifier (4 partes) — usar `icon-sliders` ou `icon-layers` (evitar clichê de "estrelinhas IA") |

---

## 6. Especificação de Componentes Base

### 6.1 Botões (`.btn`)
- Altura padrão: `32px` (`.btn-sm`: `26px`, `.btn-lg`: `38px`). Padding horizontal: `12px`. Raio: `--radius-md`.
- Variantes:
  - **Primário (`.btn-primary`):** fundo `--accent-solid`, texto `--text-inverse`, borda transparente.
  - **Secundário (`.btn-secondary`):** fundo `--bg-elevated`, texto `--text-primary`, borda `1px solid --border-default`.
  - **Ghost (`.btn-ghost`):** fundo transparente, texto `--text-secondary`; hover `--bg-subtle` + `--text-primary`.
  - **Perigo / Stop (`.btn-danger`):** fundo `--danger-solid`, texto `--text-inverse` (ou outline `--status-danger-bg` + `--status-danger-text` para ações secundárias destrutivas).
- Estado `disabled`: `opacity: 0.45; cursor: not-allowed; pointer-events: none`.
- Estado `loading`: substitui ícone inicial por spinner SVG `14px` rotativo (estático em `prefers-reduced-motion`) e mantém largura mínima para evitar *layout shift*.

### 6.2 Badges e Pills (`.badge`)
- Altura: `20px` (compacto) ou `22px` (padrão); padding `0 8px`; fonte `--text-xs`, `font-weight: 600`; raio `--radius-sm` para tags técnicas (Prioridade `P0`, Tier `T2`, ID) e `--radius-pill` para estados vivos (`Executando`, `SSE Conectado`, `Em paridade`).
- **Indicador "Executando" (`.badge-running`):**
  - Fundo `--status-running-bg`, borda `1px solid --status-running-border`, texto `--status-running-text`.
  - Ponto pulsante de `6px` (`@keyframes pulse-ring` 1.8s ease-out; estático em `prefers-reduced-motion`) + rótulo `Executando` + cronômetro tabular (`01:42`).

### 6.3 Card Kanban (`.task-card`)
- Fundo `--bg-surface`, borda `1px solid --border-default`, raio `--radius-md`, padding `12px`, sombra `--shadow-sm`.
- **Faixa lateral de prioridade:** `border-left: 3px solid` usando a cor de prioridade (`P0` coral, `P1` âmbar, `P2` azul, `P3` cinza) para leitura periférica imediata.
- **Estado `Executando` no card:** borda `1px solid --status-running-border`, brilho sutil `box-shadow: 0 0 0 1px var(--status-running-border)` e barra de progresso indeterminada de `2px` no topo do card.
- **Estado `Inválido` (AC-03.8):** borda tracejada `1px dashed --status-danger-border`, fundo `--status-danger-bg`, ícone `icon-x-circle` + caminho do arquivo em mono + erro do validador.
- **Estado `Dragging`:** `opacity: 0.55`, rotação sutil `rotate(1deg)`, sombra `--shadow-md`; zona de soltura válida recebe `outline: 2px dashed var(--accent-text)` + fundo `--accent-soft-bg`; coluna proibida pela matriz §8.2 recebe `opacity: 0.35; cursor: no-drop` e selo flutuante "Transição proibida".

### 6.4 Toggle Switch (`.toggle`)
- Usado para **"Auto-executar ao arrastar para Em Progresso"** e filtros booleanos.
- Dimensões: trilha `34×18px`, raio `--radius-pill`, botão interno `14×14px`.
- Acessibilidade: `<button role="switch" aria-checked="true|false">` com rótulo visível associado e foco `--focus-ring`.

### 6.5 Drawers Laterais (`.drawer`)
- Largura desktop: `--drawer-width` (`520px`, `max-width: 92vw`), fixo à direita, fundo `--bg-surface`, borda esquerda `1px solid --border-default`, sombra `--shadow-lg`.
- Cabeçalho fixo (`sticky top: 0`) com breadcrumb/ID em mono, título e botão fechar (`Esc`). Corpo rolável independente. Rodapé fixo para ações primárias quando houver edição.
- Acessibilidade: `role="dialog"`, `aria-modal="true"`, focus trap ativo, retorna foco ao elemento gatilho ao fechar.

### 6.6 Diálogo Level C (`.modal-level-c`)
- Largura `480px`, centralizado sobre `--bg-overlay`, borda superior de destaque `3px solid var(--status-warn-text)`.
- **Segurança contra confirmação acidental (PRD §8.4):**
  - Foco inicial vai para o botão **"Cancelar"** (nunca para o botão de confirmar).
  - Exige ação afirmativa explícita (checkbox *"Confirmo que esta tarefa foi publicada"* ou confirmação nominal dos arquivos a sobrescrever) antes de habilitar o botão de confirmação. `Enter` fora do botão habilitado não dispara a ação.

### 6.7 Console de Execução ao Vivo (`.exec-console`)
- Dock inferior colapsável (`height: 40px` colapsado / `--console-height: 260px` expandido / `55vh` maximizado), fundo `--bg-inset` (`#080A0D` no dark, `#0F172A` no light — sempre escuro para leitura de logs técnicos com contraste `>= 11:1`).
- Barra de etapas (Stepper horizontal compacto): `1. Amplificando Prompt` → `2. Decompondo` → `3. Executando` → `4. Gate`.
- Botão **"Parar execução"** (`.btn-danger`) sempre visível no cabeçalho do console quando houver run ativo.

### 6.8 Toasts e Banners Globais
- **Toasts:** canto inferior direito (acima do console se expandido), largura `360px`, empilhamento máximo de 3, `role="status"` (`aria-live="polite"`) para sucesso/info e `role="alert"` (`aria-live="assertive"`) para violação de regra/erro. Auto-dismiss em `5s` para info/sucesso; **persistente** para erros de validação até o usuário fechar.
- **Banner Desconectado (HU-16):** faixa fixa abaixo da topbar (`height: 36px`), fundo `--status-danger-bg`, borda inferior `--status-danger-border`, texto `--status-danger-text`, ícone `icon-alert-triangle`: *"Desconectado dos arquivos — dados podem estar desatualizados. Ações de escrita desabilitadas."* + botão "Tentar reconectar".

### 6.9 Estados Universais (Empty, Loading, Error)
- **Loading (Skeleton):** blocos retangulares com gradiente linear sutil `--bg-subtle → --bg-elevated → --bg-subtle` (`1.6s linear infinite`; sólido em `prefers-reduced-motion`). Nunca bloqueia a sidebar.
- **Empty:** caixa centrada dentro da área de conteúdo (não na página toda), ícone SVG `28px` em `--text-muted`, título em `--text-md`, 1 frase explicativa em `--text-secondary` e 1 CTA primário claro.
- **Error:** card com borda `--status-danger-border`, causa exata, comando ou caminho do arquivo em `--font-mono` e botão "Tentar novamente" quando aplicável.
