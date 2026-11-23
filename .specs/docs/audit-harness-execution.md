# Auditoria de Execução e Auto-Melhoria do Harness — Sessão Harness Hub

**Data:** 2026-11-23
**Auditor:** Harness Auditor (`.claude/rules/85-self-improvement.md`)
**Escopo auditado:** Execução real da construção do Harness Hub (`hub/`, `scripts/{hub,sync-adapters}.mjs`, `.specs/docs/*`, `context/*`, `.claude/*`, `scripts/validate-harness.mjs`, `.specs/harness/incidents.jsonl`).
**Veredito geral:** O harness sustentou uma entrega T3/Project complexa com **45/45 testes passando** (`node --test hub/tests/*.test.mjs`) e **selftest verde** (`node evals/scripts/selftest.mjs`), mas expôs **2 BLOCKERs estruturais**, **2 MAJORs de protocolo** e **2 MINORs de higiene** que precisam ser fechados antes de novas evoluções.

---

## 1. O que funcionou muito bem (com evidências)

1. **Isolamento de escrita entre slices paralelos (zero colisão de arquivos):**
   - A separação em slices disjuntos (`S1`–`S5` em `.specs/docs/spec-harness-hub.md:525-531`) respeitou a regra de dois escritores nunca editarem o mesmo arquivo (`AGENTS.md:31`, `.claude/rules/20-delegation.md:74-76`).
   - Resultado verificado: **45 testes em 13 suites passando em 3,17s** (`node --test hub/tests/*.test.mjs` → `45 pass, 0 fail`), incluindo 10 reivindicações simultâneas de lock atômico (`hub/tests/store.test.mjs`) e E2E HTTP/SSE (`hub/tests/server.test.mjs`).
2. **Oráculos externos reais em vez de inspeção visual:**
   - Todos os testes de `S1` e `S3` executam o validador real `scripts/validate-task.mjs` sobre arquivos temporários (`hub/tests/store.test.mjs`, `hub/tests/runner.test.mjs`), e `S2` valida projeções contra `80-prompt-amplifier.md` com hash SHA-256 (`hub/tests/adapters.test.mjs`).
   - `node evals/scripts/selftest.mjs` → `Selftest: PASS (0 failed)`.
3. **Disciplina de decisões arquiteturais (ADRs) e zero-budget-creep:**
   - `context/DECISIONS.md:1-87` documentou 6 ADRs comparando 2–3 opções reais (ex.: ADR-001 Node 24 zero-deps vs Python/Vite; ADR-003 locks `wx` vs lock global; ADR-006 projeções SHA-256 vs symlinks no Windows).
   - Nenhuma regra canônica em `.claude/rules/` foi inchada durante a entrega (`node scripts/validate-harness.mjs` → `PASS (0 errors, 1 warnings)`).
4. **Rastreabilidade histórica de auto-melhoria:**
   - `.specs/harness/incidents.jsonl` (verificado via `node scripts/incident.mjs list`) registra 22 incidentes anteriores todos fechados com causa raiz e verificação mecânica — demonstrando que o loop da regra 85 funciona quando acionado.

---

## 2. Lista priorizada de lacunas e falhas reais encontradas

### BLOCKER

#### B1. Orçamento sempre carregado no limite absoluto (32 B livres / 90 ch livres)
- **Evidência:**
  - `scripts/validate-harness.mjs:9-10` define `MAX_ALWAYS_BYTES = 33000` e `MAX_DESC_CHARS = 19300`.
  - Saída real de `node scripts/validate-harness.mjs`: `constitution+rules 32968 B (max 33000)` (**0,097% de margem — 32 bytes**) e `descriptions 19210 ch (max 19300)` (**0,46% de margem — 90 chars**).
  - `scripts/validate-harness.mjs:161` usa `statSync(join(rulesDir, f)).size` (bytes brutos em disco). No Windows, se `core.autocrlf=true` converter os ~600 newlines de `.claude/rules/*.md` para CRLF, o orçamento estoura em ~600 B instantaneamente sem mudar 1 único token.
- **Impacto:** Bloqueia literalmente qualquer correção de 1 linha em qualquer regra (`.claude/rules/*.md`) ou descrição de skill/agente, paralisando o loop de auto-melhoria da regra 85.
- **Correção concreta:** Executar plano de folga da §3 (cortar redundâncias em regras + descrições inchadas para atingir ~10% de folga), normalizar `\r\n` → `\n` na contagem em `scripts/validate-harness.mjs:160-161` e adicionar `.gitattributes` travando `*.md text eol=lf`.
- **Incidente aberto:** `always-loaded-budget-exhausted` (registrado via `incident.mjs add`).

#### B2. Entrega T3/Project inteira executada sem task file em `.specs/tasks/` e com `CLAUDE.md` defasado
- **Evidência:**
  - `.claude/rules/10-orchestration.md:49` exige `Task file in .specs/tasks/` = `✔` para T2 e T3; `.claude/rules/75-context-docs.md:43,50` exige `.specs/tasks/task-<slug>.md` e `.specs/STATE.md` para projetos multi-fase.
  - Verificação real: `Test-Path .specs/tasks` retornou **`False`**; `.specs/STATE.md` não existe.
  - `CLAUDE.md:67` ainda declara `None — this repo has no application code.` apesar de `hub/` (18 arquivos), `scripts/hub.mjs`, `scripts/sync-adapters.mjs` e `context/{DECISIONS,DESIGN}.md` existirem (violando `.claude/rules/75-context-docs.md:21-33`).
- **Impacto:** Sem `.specs/tasks/task-*.md`, três mecanismos determinísticos do harness ficam cegos: `scripts/task-diff.mjs` (exigido em `.claude/skills/audit/SKILL.md:12`), `scripts/validate-task.mjs` e `.claude/hooks/session-start.mjs` (retomada entre sessões).
- **Correção concreta:**
  1. Criar o task file retroativo `.specs/tasks/task-harness-hub-mvp.md` (ou garantir que `/build` recuse iniciar fan-out T3 sem `Test-Path` do task file) e atualizar `CLAUDE.md:33-68` (Context index + comando `node --test hub/tests/*.test.mjs` na tabela `## Verification`).
  2. Em `.claude/skills/build/SKILL.md:8-10`, tornar explícito que fan-out T3 sem `node scripts/validate-task.mjs <task-file>` verde é proibido (não apenas "preferred").

---

### MAJOR

#### M1. Drift de contrato entre slices paralelos (`S1` / `S3` / `S4` / `S5`)
- **Evidência exata (`arquivo:linha`):**
  1. **Enum & Agente inválidos (S3 vs S1):** `hub/lib/github.mjs:463,475` mapeia `pr_review` para `agent: 'code-reviewer'` e `type: 'Review'`. Porém `hub/lib/state-machine.mjs:40` define `TYPES = ['Feature', 'Bug', 'Hotfix', 'Prototype', 'Docs', 'Ops', 'Harness']` (sem `'Review'`) e `hub/lib/state-machine.mjs:45,273` coloca `'@code-reviewer'` em `READ_ONLY_AGENTS` (rejeitado como `assignee` também em `hub/lib/store.mjs:1303`). S4 precisou remendar com normalização defensiva em `hub/server.mjs:809-818`.
  2. **Persistência perdida em `config` (S1 vs S4/S5):** `hub/lib/store.mjs:50-55,627-657` (`DEFAULT_CONFIG` e `updateConfig`) não aceita nem persiste `theme` e `boardViewMode`. S4 precisou criar `uiPrefs` em RAM (`hub/server.mjs:225-228,1040-1041`) — logo, **preferências de tema e modo do board são perdidas ao reiniciar o servidor**.
  3. **Aliases duplicados na API e SSE (S4 compensando S1/S5):** `hub/server.mjs:276,311,323-324,328-329,1006-1010` retorna e aceita chaves duplicadas (`roster`+`agents`, `activeRuns`+`runs`, `maxConcurrentRuns`+`maxConcurrency`), e emite eventos SSE duplicados (`adapter:updated` + `adapters:synced` em `hub/server.mjs:911-919`; `gate:updated` + `gate:finished` em `hub/server.mjs:968-982`).
  4. **Divergência de porta padrão (Spec vs S4/CLI):** `.specs/docs/spec-harness-hub.md:16,249,481` e `hub/lib/github.mjs:56-57` usam porta `7331`, mas `hub/server.mjs:21` e `scripts/hub.mjs:22,32` implementaram `DEFAULT_PORT = 7420`.
- **Causa raiz no harness:** `.claude/agents/tech-lead.md:26-27` e `.claude/skills/blueprint/SKILL.md:39-41` exigem escopos de **arquivos disjuntos** entre slices, mas não exigem uma **Tabela de Contrato Congelado** (nomes exatos de exports, enums, chaves JSON, portas e códigos de erro) nem um check de paridade de contratos no passo "After a fan-out" de `.claude/skills/build/SKILL.md:56-60`.
- **Correção concreta:**
  - Em `.claude/agents/tech-lead.md:27` e `.claude/skills/blueprint/SKILL.md:39`, exigir que todo fatiamento com `>= 2` slices inclua `## Frozen contracts` (exports, enums, campos persistidos, porta/defaults, eventos).
  - Em `.claude/skills/build/SKILL.md:58-59`, adicionar verificação obrigatória pós-fan-out: zero aliases defensivos não especificados e consistência entre produtor (S1/S3) e consumidor (S4/S5).
- **Incidente aberto:** `cross-slice-contract-drift` (registrado via `incident.mjs add`).

#### M2. Falta de protocolo de recuperação para subagentes interrompidos por cota (`429 RESOURCE_EXHAUSTED`)
- **Evidência:**
  - `.claude/rules/20-delegation.md:82-84` ("When an agent fails") trata apenas resposta vazia, ausência de handoff, fabricação ou timeout, instruindo re-dispatch imediato e registro obrigatório de incidente.
  - Durante a sessão, `@tech-lead` e `@designer` foram interrompidos no meio da escrita por `RESOURCE_EXHAUSTED 429`.
- **Lacuna real:**
  1. Nenhum passo exige inspecionar `git status` / truncamento de arquivos já parcialmente escritos antes de re-despachar (risco de arquivo corrompido ou duplicação no retry).
  2. A regra não distingue **falha transiente de provedor/cota (429/5xx)** — que exige failover de modelo/provedor e retomada idempotente — de **defeito comportamental do agente** (que dispara `/agent-creator` na 2ª ocorrência segundo `20-delegation.md:84`).
- **Correção concreta:** Adicionar 2 linhas objetivas em `.claude/rules/20-delegation.md:84` (cortando redundância equivalente no mesmo arquivo para manter budget negativo): *"Before re-dispatching a writer after interruption/429, inspect touched files for truncation and pass their exact state in CONTEXT; provider quota/429 is a failover event, not an agent defect."*
- **Incidente aberto:** `subagent-quota-interruption-unhandled` (registrado via `incident.mjs add`).

---

### MINOR

#### m1. Warning persistente de sintaxe de wildcard em `.claude/settings.json` vs template
- **Evidência:**
  - `.claude/settings.json:17-45` usa `":*)"` (ex.: `"Bash(git push:*)"`).
  - `.claude/templates/settings.harness.json:17-45` usa `" *)"` (ex.: `"Bash(git push *)"`).
  - `scripts/validate-harness.mjs:194-196` emite `warn .claude/settings.json — two permission wildcard syntaxes in use (":*)" and " *)")` em toda execução.
- **Impacto:** Efeito "janela quebrada": acostuma a equipe a ignorar warnings do validador.
- **Correção concreta:** Verificar a sintaxe honrada pela versão instalada do Claude Code (no schema atual, `"Bash(cmd *)"` ou `"Bash(cmd:*)"`) e padronizar ambos os arquivos (ação Level C por `.claude/rules/85-self-improvement.md:22`, pois toca `settings.json`).

#### m2. Fragilidade de one-liners em PowerShell no Windows (edge case operacional)
- **Evidência:** Ao executar `node -e` inline em PowerShell com aspas simples/duplas escapadas, o parser do PowerShell falha (`MissingTypename`), exigindo here-string `@' ... '@ | node --input-type=module`. Além disso, `validate-harness.mjs:161` mede `statSync.size` bruto sem normalizar CRLF.
- **Correção concreta:** Normalizar LF na medição de orçamento em `validate-harness.mjs:161` e documentar em `context/GOTCHAS.md` o padrão de here-string para scripts ad-hoc no Windows.

---

## 3. Análise de Orçamento (`validate-harness.mjs`) e Plano de Folga Segura

### Raio-X atual (medido em disco)

| Camada | Atual | Teto | Margem | Status |
|---|---:|---:|---:|---|
| `CLAUDE.md` (constituição) + 12 regras (`.claude/rules/*.md`) | **32.968 B** | 33.000 B | **32 B (0,10%)** | Crítico |
| Descrições de 14 agentes + 33 skills | **19.210 ch** | 19.300 ch | **90 ch (0,47%)** | Crítico |

#### Top ofensores em `.claude/rules/` (total: 31.212 B + 1.756 B constituição = 32.968 B)
| Arquivo | Bytes | % do total | Oportunidade de corte sem perda semântica |
|---|---:|---:|---|
| `20-delegation.md` | 5.069 B | 15,4% | Tabela "When an agent MUST ask for help" (11 linhas) repete descrições já carregadas no frontmatter dos agentes (-700 B) |
| `10-orchestration.md` | 4.442 B | 13,5% | Compactar exemplos verbosos na coluna Signal da tabela Triage e texto duplicado de "Sensitive surface" (também listado em `audit/SKILL.md:17` e `60-security.md`) (-500 B) |
| `00-core.md` | 3.495 B | 10,6% | Condensar prosa repetitiva mantendo princípios numerados (-400 B) |
| `40-quality-gates.md` | 2.897 B | 8,8% | Lista longa de exemplos de oráculos na linha 41 já vive em `.claude/skills/build/references/verification.md` (-350 B) |
| `30-autonomy.md` | 2.632 B | 8,0% | Compactar exemplos redundantes (-200 B) |
| `85-self-improvement.md` | 2.483 B | 7,5% | OK (procedimento já foi movido para `/retro`) |
| `75-context-docs.md` | 2.394 B | 7,3% | OK |

#### Top ofensores em descrições (agents: 4.959 ch · skills: 14.251 ch · total: 19.210 ch)
| Tipo | Nome | Chars | Meta sugerida | Economia |
|---|---|---:|---:|---:|
| skill | `retro` | 658 | ≤ 350 | −308 ch |
| skill | `agent-creator` | 647 | ≤ 350 | −297 ch |
| skill | `design` | 610 | ≤ 350 | −260 ch |
| skill | `discovery` | 599 | ≤ 350 | −249 ch |
| skill | `skill-architect` | 573 | ≤ 350 | −223 ch |
| skill | `kickoff` | 571 | ≤ 350 | −221 ch |
| skill | `create-adr` | 561 | ≤ 350 | −211 ch |
| skill | `feature-requirement` | 515 | ≤ 350 | −165 ch |
| agent | `ai-engineer` | 503 | ≤ 350 | −153 ch |
| skill | `security-checker` | 456 | ≤ 320 | −136 ch |
| **Subtotal (Top 10)** | | **5.693 ch** | **≤ 3.470 ch** | **−2.223 ch** |

### Plano de folga segura (meta: ≥ 10% de margem operacional)
1. **Não elevar os tetos (`33000 B` / `19300 ch`) como primeira resposta.** Elevar teto sem cortar gordura viola `85-self-improvement.md:27` (*"to add, cut"*).
2. **Enxugamento cirúrgico de regras (~2.150 B economizados):** leva `alwaysBytes` de `32.968 B` → **~30.800 B** (**~2.200 B livres / 6,7% de margem**), abrindo espaço real para a correção M2 (`20-delegation.md`) e futuras evoluções.
3. **Cap de 350 ch nas top 10 descrições (~2.220 ch economizados):** leva `descriptions` de `19.210 ch` → **~17.000 ch** (**~2.300 ch livres / 11,9% de margem**), sem perder nenhuma trigger phrase de roteamento.
4. **Warning preventivo no validador:** em `scripts/validate-harness.mjs`, emitir `warn` quando a margem ficar abaixo de **5%** (`< 1650 B` ou `< 965 ch`), evitando descobrir o teto apenas quando já estamos a 32 B do limite.

---

## 4. Apertar o existente vs. Criar nova Skill ou Novo Agente

Seguindo `.claude/rules/85-self-improvement.md:26-27` e `.claude/skills/retro/SKILL.md:63` (*"prefer removing a tool or adding a validator check over adding prose"*), **nenhum novo agente permanente deve ser criado agora**. Criar um 15º agente consumiria ~350–450 ch fixos em toda sessão e aumentaria o custo de roteamento.

| Candidato avaliado | Veredito | Justificativa técnica | Onde resolver de verdade |
|---|---|---|---|
| **Novo agente `@harness-auditor`** | **NÃO criar** | Sobrepõe diretamente `/retro` + `/harness-check` + regra 85. Custa ~400 ch permanentes para uma tarefa periódica. | Apertar `.claude/skills/retro/SKILL.md` adicionando 3 checks objetivos no Step 1: margem de budget (<5%), warnings persistentes do validador e drift de contratos em entregas T3. |
| **Novo agente `@contract-validator`** | **NÃO criar** | Drift entre slices é falha de **planejamento** e **integração**, não falta de mais um revisor pós-fato. | Apertar `.claude/agents/tech-lead.md:27` + `.claude/skills/blueprint/SKILL.md:39` (seção obrigatória `## Frozen contracts` quando `Slices >= 2`) e `.claude/skills/build/SKILL.md:58` (checagem de paridade na integração). |
| **Novo agente `@ui-visual-verifier`** | **NÃO criar** | `@qa-engineer` + `@designer` + `.claude/skills/design/references/ui-gate.md` já cobrem o UI gate (`40-quality-gates.md:35-37`, `audit/SKILL.md:19`). | **Skill opcional de projeto** (ou script Playwright/CDP em `optional/skills/`), acionada por `@qa-engineer` quando houver UI web — sem pagar custo no core para projetos CLI/backend. |
| **Skill opcional `/contract-check` (ou script em `scripts/`)** | **Avaliar só se M1 recorrer** | Pela regra 85 (Tier "Fix on recurrence"), primeiro endurecemos `tech-lead` + `blueprint` + `build`. Só se `cross-slice-contract-drift` ocorrer 2ª vez justificaria automação dedicada. | Manter incidente `cross-slice-contract-drift` rastreado. |

---

## 5. Próximos passos concretos de lapidação (ordem de execução)

1. **[P0 — Imediato, Level A] Corrigir dívida de conformidade desta sessão no projeto:**
   - Atualizar `CLAUDE.md:33-68` (Context index listando `context/DECISIONS.md` e `context/DESIGN.md`; adicionar gate `hub-tests` com `node --test hub/tests/*.test.mjs` em `## Verification`).
   - Registrar `.specs/tasks/task-harness-hub-mvp.md` (ou garantir que o próximo slice/fix do Hub nasça com task file validado por `validate-task.mjs`).
   - Alinhar os 4 drifts do Hub em um fix pass curto: persistir `theme`/`boardViewMode` em `hub/lib/store.mjs:627-657`, unificar porta padrão (`7331` ou `7420` na spec + código), remover `'Review'`/`'code-reviewer'` incompatíveis em `hub/lib/github.mjs:463,475` e eliminar aliases redundantes em `hub/server.mjs`.
2. **[P0 — Imediato, Level A via `/retro`] Abrir folga segura de orçamento (`always-loaded-budget-exhausted`):**
   - Cortar ~2.150 B nas regras mais gordas (`20-delegation.md`, `10-orchestration.md`, `00-core.md`, `40-quality-gates.md`) e ~2.220 ch nas top 10 descrições de skills/agentes.
   - Em `scripts/validate-harness.mjs:160-163`, normalizar `\r\n` → `\n` na contagem de bytes e adicionar warning quando a folga cair abaixo de 5%.
   - Adicionar `.gitattributes` com `*.md text eol=lf`.
3. **[P1 — Curto prazo, Level A via `/retro`] Fechar incidentes `cross-slice-contract-drift` e `subagent-quota-interruption-unhandled`:**
   - Exigir `## Frozen contracts` em `tech-lead.md:27` e `blueprint/SKILL.md:39` para tarefas com `>= 2` slices, e check pós-fan-out em `build/SKILL.md:58`.
   - Adicionar protocolo de recuperação pós-429/interrupção em `20-delegation.md:84` (inspecionar arquivos parciais antes de retry; separar failover de provedor de defeito de agente).
4. **[P2 — Level C, requer decisão do usuário] Limpar warning de `.claude/settings.json`:**
   - Confirmar a sintaxe de wildcard honrada pela versão local do Claude Code (`":*)"` vs `" *)"`) e unificar `.claude/settings.json` e `.claude/templates/settings.harness.json` para alcançar `Validator: PASS (0 errors, 0 warnings)`.
5. **[P2 — Validação final] Fechar o ciclo com prova:**
   - Rodar `node scripts/validate-harness.mjs`, `node evals/scripts/selftest.mjs`, `node scripts/incident.mjs fix ...` para cada incidente corrigido e registrar 1 linha por correção em `CHANGELOG.md`.
