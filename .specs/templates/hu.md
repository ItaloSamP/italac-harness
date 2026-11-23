# HU-NNN — <Título curto e claro da História de Usuário>

## Metadados
- **ID:** HU-NNN
- **Épico / Módulo:** <ex: Kanban & Backlog | GitHub Inbox | Multi-AI | Execução>
- **Prioridade:** P1 (P0 Crítica | P1 Alta | P2 Média | P3 Baixa)
- **Tier estimado:** T2 (T1 | T2 | T3 | Prototype)
- **Quadro inicial:** Planejado (`planned` | `scheduled` | `to_fix` | `queued`)
- **Agente sugerido:** `@developer` (`@designer` | `@code-reviewer` | `@qa-engineer` | `@tech-lead` | ...)
- **Engine de IA alvo:** `antigravity` (`claude` | `codex` | `cursor` | `mock`)
- **Destino:** `commit-local` (`working-tree` | `commit-local` | `pr` [Level C] | `deploy` [Level C])
- **Origem:** Manual | GitHub Issue `#NNN` | GitHub PR `#NNN`

---

## História de Usuário
**Como** <papel / operador do harness>,
**quero** <ação ou capacidade desejada>,
**para que** <valor concreto / resultado observável>.

---

## Contexto & Motivação
- **Problema atual:** <o que acontece hoje ou o que falta>
- **Material mais bruto de referência:** <arquivo, log, endpoint, issue ou PR original>
- **Fora de escopo (o que NÃO fazer):**
  - <item fora de escopo 1>
  - <item fora de escopo 2>

---

## Critérios de Aceitação (ACs — 100% testáveis)
- [ ] **AC-01:** Dado <estado inicial>, quando <ação>, então <resultado verificável com número ou evidência> — evidence:
- [ ] **AC-02:** Dado <estado de erro/vazio/bloqueado>, quando <ação>, então <comportamento esperado> — evidence:
- [ ] **AC-03:** <invariante de segurança, acessibilidade ou harness> — evidence:

---

## Estados & Fluxos (para HUs com interface)
- **Empty:** <o que aparece quando não há itens>
- **Loading / Running:** <feedback visual durante execução>
- **Error / Blocked:** <mensagem acionável e ação de recuperação>
- **Responsivo / Teclado:** <como operar sem mouse e em telas menores>

---

## Prova Externa (Oráculo)
- **Comando / Verificação:** <ex: `node --test ...`, requisição HTTP, screenshot Playwright, `node scripts/validate-harness.mjs`>
- **Revisores obrigatórios:** `@code-reviewer` (e `@qa-engineer` / `@designer` quando aplicável)

---

## Prompt Amplifier (Regra `80-prompt-amplifier.md`)
> Ao mover esta HU para **Em Execução**, o agente aplica os 4 passos antes de executar:
> 1. O que um profissional de alto nível faria aqui que não foi pedido;
> 2. O material mais bruto de partida;
> 3. Métodos e ferramentas específicas;
> 4. O que, além de nós, comprova que o resultado está correto.
