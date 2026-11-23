# Review: mesa-redonda sobre o harness (2026-11-10)

Participantes: **Tech Lead (TL)**, **Product Manager (PM)**, **AI Engineer (AIE)**.
Método: simular um projeto grande, fase a fase, e anotar onde o fluxo quebra. Evidência usada: os arquivos reais, a doc oficial do Claude Code (via pesquisa — parte não confirmada, ver fim) e um `@explorer` despachado de verdade contra o próprio harness.

## 1. A conversa, por fase

### Elicitação / discovery
- **PM:** "O `@product-manager` é subagente. Subagente não conversa com o usuário. Então quem faz a entrevista? Hoje ninguém — o agente chuta e escreve um PRD de suposições."
- **AIE:** "É limitação do runtime: ele recebe um brief e devolve um handoff. Elicitação tem que rodar na thread principal."
- **TL:** "E a regra de autonomia diz 'não pergunte'. Mas visão de produto *é* decisão do usuário."
- **Decisão:** skill `/discovery` inline. Colhe o que já se sabe, classifica cada incógnita (assumível / pesquisável / do usuário), faz **uma** rodada de até 5 perguntas com default recomendado, e só então manda o `@product-manager` redigir. Um checkpoint: confirmar o corte da v1.

### Prototipação
- **PM:** "A ordem estava errada no T3: ia de PM direto para arquitetura. Protótipo vem antes de design e de arquitetura — é barato e mata suposição."
- **TL:** "`/prototype` existe e está bom, mas ficava solto, sem lugar no ciclo."
- **Decisão:** vira a fase 2 do `/kickoff`. Protótipo é descartável; o aprendizado alimenta design e arquitetura.

### Design
- **PM:** "O `@designer` produzia código e `DESIGN.md`, mas nenhum artefato de fluxos e estados. Dev constrói adivinhando."
- **AIE:** "E o catálogo só tinha `frontend-design` para gosto visual. Surgiram duas opções: taste-skill e ui-ux-pro-max." (ver seção 3)
- **Decisão:** `@designer` passa a escrever `.specs/docs/design-<slug>.md` na fase de design; ganha regra de copy (texto real, sem superlativo vazio, sem depoimento inventado) e verificação em 390/768/1440.

### Arquitetura e documentação
- **TL:** "Aqui está sólido: spec, ADR, threat model, fatiamento. Tirei o RFC — RFC é para alinhar stakeholders, não faz sentido para um dev solo."
- **AIE:** "Faltava o papel de quem faz feature com LLM. O usuário constrói agentes; sem eval, feature de IA vira demo que quebra no décimo input."
- **Decisão:** novo `@ai-engineer` (eval antes de mexer em prompt; saída do modelo é input não confiável; fatos de modelo vêm da doc atual, nunca da memória).

### Implementação em escala
- **TL:** "O buraco maior: não existia nada acima do task file. Projeto grande tem dezenas de tarefas e várias sessões. Sem roadmap e sem estado, a segunda sessão começa cega."
- **AIE:** "E o contexto da thread principal compacta. Estado tem que estar em arquivo."
- **TL:** "Outro: devs em paralelo na mesma árvore vão brigar por `package.json`, lockfile, registro de rotas, numeração de migration."
- **Decisão:** `/kickoff` com 8 fases, um artefato e um gate por fase; `.specs/ROADMAP.md` (milestone 1 = walking skeleton, fatias verticais) e `.specs/STATE.md` (lido pelo hook de sessão). Regra de **hot files**: só o Maestro mexe, dev devolve a mudança em `INTEGRATION:`. Limite de 4 agentes em voo.

## 2. Falhas encontradas e status

| # | Falha | Sev. | Correção |
|---|-------|------|----------|
| 1 | Sem ciclo de projeto grande (roadmap, estado, fases) | BLOCKER | `/kickoff` + templates `state.md`, `roadmap.md` + tier *Project* |
| 2 | Elicitação impossível via subagente | BLOCKER | `/discovery` inline; descrição do PM corrigida |
| 3 | Bloco de handoff divergente em 10 de 13 agentes (achado pelo `@explorer`) | MAJOR | Linha `STATUS` canônica em todos + validador passa a exigir |
| 4 | Devs paralelos colidindo em arquivos compartilhados | MAJOR | Regra de hot files + `INTEGRATION:` |
| 5 | Regras do Maestro carregam também nos subagentes (eles tentariam triar/amplificar) | MAJOR | Seção "If you are a subagent" em `00-core.md` |
| 6 | Skills vendorizadas mandando entrevistar/esperar aprovação, contra a autonomia | MAJOR | Precedência explícita em `00-core.md` |
| 7 | Sem política para agente que falha (sem handoff, alucinação, timeout) | MAJOR | "When an agent fails" em `20-delegation.md` |
| 8 | `BLOCKED` sem dono; `/bugfix` e fan-out sem setar status | MINOR | Corrigido em `10`, `/build`, `/bugfix` |
| 9 | Rotas diferentes entre `CLAUDE.md`, `AGENTS.md` e regra 10 | MINOR | Unificadas |
| 10 | Hotfix: "review depois do merge" vs "em paralelo" | MINOR | Unificado: em paralelo, sobre o diff |
| 11 | Gate do committer: "antes de cada commit" vs "antes do primeiro" | MINOR | Unificado: uma vez |
| 12 | Committer exigia `READY_TO_COMMIT` também sem task file | MINOR | Só no Modo A |
| 13 | Descrições fracas (`test-generator`, `test-runner`, `security-checker`, `lessons-writer`) — sem gatilho, o modelo não roteia | MAJOR | Reescritas com o quê + quando + quando não |
| 14 | Agente e skill com o mesmo nome (`docs-writer`) | MINOR | Agente virou `@tech-writer` |
| 15 | Sintaxe de permissão legada (`:*`) | MINOR | Trocada por `Bash(cmd *)` |
| 16 | Sem criador de agentes próprio; sem evals de agente | MAJOR | `/agent-creator` + `evals/agents/` |
| 17 | Sem papel para features de IA | MAJOR | `@ai-engineer` |
| 18 | Referência a template de handoff inexistente; skill removida ainda citada | MINOR | Corrigido |

## 3. Catálogo de skills

**AIE:** "Cada descrição é carregada em toda sessão. 40 skills custavam contexto e confundiam o roteamento."

| Decisão | Skills | Motivo |
|---------|--------|--------|
| Removidas | `not-your-babysitter`, `codenavi`, `subagent-creator`, `harness-eval`, `create-rfc`, `web-quality-audit` | Duplicavam regras 00/30; mantinham memória paralela (`.notebook/`) concorrendo com `context/`; substituídas por skill própria; dependiam de skills não instaladas |
| Movidas para `optional/` | `figma-implement-design`, `html-to-figma` | Só servem com Figma MCP conectado |
| Criadas | `agent-creator`, `kickoff`, `discovery` | Lacunas 1, 2, 16 |
| Melhoradas | 4 descrições do gc-harness, 2 nomes | Falha 13 |

Resultado: **35 skills** (12 próprias, 23 reaproveitadas), ~5,3k tokens de descrições sempre carregadas.

### taste-skill e ui-ux-pro-max — veredito revisado: motores de design de primeira classe

**Segunda rodada (a pedido do usuário), lendo o método interno e não só o tamanho:**

- **AIE:** "Errei na primeira leitura: olhei peso e nicho. O que importa é que os dois trazem o que o harness não tinha — *decisão de design com conhecimento por trás* e *prova externa para UI*. O taste-skill tem um gate que abre a página em Chrome headless em várias larguras e reprova; é a nossa regra 'evidência ou nada' aplicada a interface. O ui-ux-pro-max gera e persiste um design system por tipo de produto."
- **PM:** "E são complementares de verdade: um vende o produto (site), o outro é o produto (app). Um projeto real tem os dois."
- **TL:** "O problema era só *onde* instalar. Copiar 40 MB por projeto não; instalar uma vez por máquina como plugin, sim. O usuário inclusive já tem o ui-ux-pro-max como plugin."
- **Decisão:** nova skill `/design` (classifica a superfície → escolhe o motor → um design system por projeto → spec → build → gate de UI no browser). `@designer` passa a seguir `/design`. Gate de UI entra na Definition of Done (regra 40) e no painel do `/audit`. Checklist próprio `ui-gate.md`, destilado dos dois, vale como piso mesmo sem motor instalado. Sem motor: fallback para `/frontend-design` e aviso único.
- **Não adotado:** `brand`, `slides`, `banner-design` e geração de logo do repositório do ui-ux-pro-max (pedem chave de API de modelo de imagem; fora do fluxo de desenvolvimento).

Registro da primeira rodada, mantido para histórico:

#### Primeira leitura — não vendorizar, integrar como opcionais

- **TL:** "taste-skill tem ~40 MB e ~1.600 arquivos de asset, exige Node 22 e Chrome. Copiar isso para dentro de cada projeto pelo instalador é inviável."
- **PM:** "E é focada em site institucional/marketing. Metade do que o usuário constrói é app, não landing page. As regras da casa são fortes demais para virar padrão (uma seção por tela, sem violeta…)."
- **AIE:** "ui-ux-pro-max é o complemento: banco pesquisável de estilos, paletas, tipografia e regras de UX — bom para app e design system. Mas são ~4 MB de CSV e um script Python de terceiros; os irmãos (logo, banner, slides) pedem chaves de API externas."
- **Veredito:** as duas são boas e **complementares**, mas pesadas e de nicho. Ficam em `optional/README.md` com comando de instalação por projeto; o `@designer` usa quando presentes. Trouxemos só as **ideias pequenas** para o agente: copy sem cara de IA, nada inventado, verificação em três larguras.
- **Limite da avaliação:** a execução do script de busca do ui-ux-pro-max foi bloqueada pelo classificador (código externo). Avaliação feita por leitura, não por uso.

## 4. O que ficou provado e o que não

| Prova | Resultado |
|-------|-----------|
| `node scripts/validate-harness.mjs` | PASS |
| Instalação limpa (`install.sh`, `install.ps1`) + validador no destino | PASS |
| `@explorer` real, cenário 1 | PASS — handoff correto, tudo com `path:line`, 9 divergências achadas |

**Não provado:** os outros 13 agentes nunca rodaram; cenários 2 e 3 do explorer não rodaram; `/kickoff` nunca conduziu um projeto. Da doc oficial ficaram **não confirmados**: formato do campo `skills:` (lista vs string), se `Read(./.env)` é a forma exata, se subagente pode invocar `Skill`, substituição de `$ARGUMENTS`.

**Risco aberto (AIE):** um plugin do usuário (context-mode) injeta ~40 linhas em todo brief de subagente. Isso custa tokens em cada despacho e não é controlado por este harness.

## 5. Próximo passo recomendado

Rodar `/kickoff` num projeto pequeno e real. É o único teste que exercita todos os agentes juntos; os defeitos que sobraram só aparecem em uso.
