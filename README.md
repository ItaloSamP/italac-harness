# italac-harness — time de agentes para vibe coding

Harness de agentes para Claude Code: um **Maestro** (a thread principal) + 14 especialistas + 33 skills + 12 regras. Você manda um prompt; o time amplia, planeja, constrói, revisa, testa e entrega — perguntando só o que é decisão sua.

## Como usar

Abra um projeto com o harness instalado e escreva o que quer. Não precisa chamar nada pelo nome:

| Você escreve | O time faz |
|--------------|-----------|
| "adiciona login com Google" | amplia o prompt → `/blueprint` → `/build` → `/audit` → `/deliver` |
| "tá quebrando ao salvar o perfil" | `/bugfix`: reproduz → causa raiz → fix → teste de regressão |
| "produção caiu" | `/hotfix` |
| "quero ver como ficaria um dashboard assim" | `/prototype` |
| "quero criar um app de X" (projeto novo) | `/kickoff`: discovery → protótipo → design → arquitetura → roadmap → build por milestone |
| "tenho uma ideia, mas tá vago" | `/discovery`: até 5 perguntas de uma vez, assume o resto, gera o requisito |
| "cria a tela de X" / "faz a landing page" | `/design`: escolhe o motor (taste-skill ou ui-ux-pro-max), define um design system, constrói e passa o gate de UI no browser |
| "documenta esse módulo" | `@tech-writer` |
| "o CI tá vermelho" | `@devops` |
| "qual banco usar?" | `@tech-lead` (com `/the-fool` para testar a decisão) |

Também dá para chamar direto: `/blueprint`, `/build`, `/audit`, `/deliver`, `/bugfix`, `/hotfix`, `/prototype`, `/amplify`, ou `@agente`.

### O que ele faz sozinho e o que pergunta

- **Sozinho:** ler, pesquisar, decidir arquitetura/nomes/libs do projeto, editar, testar, chamar outros agentes, criar branch e commits locais.
- **Entrega solo (padrão):** trabalho pronto com gate verde entra na linha principal local, um commit por tarefa, sem perguntar. Branch + PR com commits em camadas é "collaboration mode" (instrução permanente).
- **Pergunta uma vez:** push/PR, apagar branch, deploy, apagar coisas, gastar dinheiro, segredos, bifurcação real de produto.
- Para liberar algo de vez, escreva na seção *Standing instructions* do `CLAUDE.md` do projeto (ex.: "sempre faça push quando estiver verde").

Detalhes: [.claude/rules/30-autonomy.md](.claude/rules/30-autonomy.md).

### Amplificador de prompt

Todo prompt passa por 4 perguntas antes da execução (o que um profissional de ponta faria a mais · fonte mais bruta · métodos e ferramentas · o que prova o resultado além de nós) e é reescrito. Regra: [.claude/rules/80-prompt-amplifier.md](.claude/rules/80-prompt-amplifier.md). Só quer o prompt melhorado, sem executar: `/amplify <prompt>`.

## O que o time consegue provar

Cada projeto declara o tipo e os comandos de prova na seção `## Verification` do seu `CLAUDE.md`; `node scripts/gate.mjs` roda essa tabela antes de qualquer commit. Menu por tipo: [.claude/skills/build/references/verification.md](.claude/skills/build/references/verification.md).

- **Web:** testes, chamada HTTP real e fluxo no browser.
- **Mobile:** só com um comando de simulador/emulador ou de teste de UI declarado, com screenshot; sem ele o resultado sai como NÃO VERIFICADO. O simulador de iOS não roda no Windows. Assinatura e publicação em loja não são cobertas.
- **Dashboard:** cada número principal conferido contra um número em que você já confia, mais o gate de UI.
- **Pipeline de dados:** execução de amostra em destino de dev com contagem de linhas, conferência origem × destino e uma segunda execução que não adiciona nada.
- **Análise / modelo:** métrica em holdout contra a linha de base, checagem de vazamento e mesma resposta ao rodar de novo com a mesma seed.
- **CLI / biblioteca:** testes, invocação real, instalação a partir do pacote e diff da API pública.
- **Infra:** saída do plan/dry-run lida linha a linha; aplicar só com a sua aprovação.

## Instalar em um projeto

```powershell
./install.ps1 -Target C:\caminho\do\projeto
```

```bash
./install.sh /caminho/do/projeto
```

Copia `.claude/` (regras, agentes, skills, templates, hooks), `AGENTS.md`, `CLAUDE.md` (se não existir) e cria `.specs/`. Rodar de novo atualiza o harness sem tocar em `CLAUDE.md`, `AGENTS.md` e `settings.json` existentes (use `-Force` / `--force` para sobrescrever). Depois: abra o projeto no Claude Code e escreva o que você quer. Código existente é mapeado na primeira tarefa, sem perguntas.

## Harness Hub (Painel Visual + Multi-AI)

Painel web local (Node 24, zero dependências, `127.0.0.1:7331`) que opera diretamente sobre `.specs/tasks/` e `.specs/hub/board.json`, com sincronização de regras para **Claude**, **Antigravity**, **Codex** e **Cursor**.

```powershell
# Subir o painel visual interativo (http://127.0.0.1:7331)
node scripts/hub.mjs serve

# Sincronizar / verificar paridade das regras Multi-AI (inclui Prompt Amplifier de 4 partes)
node scripts/sync-adapters.mjs
node scripts/sync-adapters.mjs --check

# Fila de demanda via CLI (qualquer IA/agente)
node scripts/hub.mjs queue
```

### Mapa de Documentação (Fonte Única de Verdade)

| Documento | O que define |
|-----------|--------------|
| [Brief Amplificado](.specs/docs/amplified-brief-harness-hub.md) | Análise em 4 passos + prompt reescrito |
| [Pesquisa `devworks-harness`](.specs/docs/research-devworks-harness.md) | Análise comparativa do código-fonte de referência |
| [PRD & HUs (MVP)](.specs/docs/prd-harness-hub.md) | 16 HUs, ACs testáveis, corte MoSCoW e regras de negócio |
| [Spec Arquitetural](.specs/docs/spec-harness-hub.md) | Arquitetura, API HTTP/SSE, CLI, locks e fatiamento S1–S5 |
| [Decisões (ADRs)](context/DECISIONS.md) | ADRs 001–006 (Node zero-dep, persistência dual, segurança, Multi-AI) |
| [Design System](context/DESIGN.md) | Tokens Dark/Light (WCAG AA), tipografia, componentes e SVGs |
| [Spec de Telas & Fluxos](.specs/docs/design-harness-hub.md) | Dois Quadros (`Planejamento` × `Execução`), GitHub Inbox e Console ao Vivo |
| [Template de HU](.specs/templates/hu.md) | Modelo reutilizável para novas Histórias de Usuário |
| [Roadmap Fase 2](.specs/docs/roadmap-harness-hub-v2.md) | Workspaces isolados, Parecer do Dia, MCPs, Chat e Failover 429 |
| [Auditoria do Harness](.specs/docs/audit-harness-execution.md) | Diagnóstico de execução, orçamento e plano de lapidação |

## Estrutura

```text
CLAUDE.md                  constituição do time + seção do projeto
AGENTS.md                  elenco e protocolo (vale para qualquer runtime)
install.ps1 · install.sh   instala/atualiza em um projeto
scripts/                   5 scripts: validate-harness ("testes" do harness), validate-task, task-diff, gate, incident
optional/                  motores de design e skills copiadas por projeto quando fizer falta
.claude/
├── rules/        12 políticas numeradas (menor número vence)
├── agents/       14 especialistas
├── skills/       33 skills (14 próprias + 19 reaproveitadas)
├── templates/    task file + modelos de context/*.md + settings.harness.json
└── hooks/        status no início da sessão
```

`settings.harness.json` traz as permissões (push/deploy pedem confirmação; force-push e leitura de `.env` negados) e o hook de sessão. O instalador copia para `.claude/settings.json` do projeto alvo. Para ativar neste próprio repositório:

```powershell
Copy-Item .claude\templates\settings.harness.json .claude\settings.json
```

Em cada projeto, o time mantém:

```text
context/*.md      memória do projeto (ARCH, API, DATA_MODEL, DESIGN, DECISIONS, GOTCHAS, …)
.specs/tasks/     task files — fonte da verdade de cada trabalho
.specs/docs/      PRDs, specs, ADRs, pesquisas, reviews
.specs/logs/      evidências e sessões de debug (ignorado pelo git)
```

## O time

| Agente | Papel |
|--------|-------|
| `@explorer` | Mapeia código (read-only, barato) |
| `@researcher` | Pesquisa externa em fontes primárias |
| `@product-manager` | O QUÊ e POR QUÊ — PRD, requisito |
| `@tech-lead` | O COMO — arquitetura, decisões, fatiamento |
| `@developer` | Implementa uma fatia, com testes |
| `@ai-engineer` | Features com LLM: prompts, evals, agentes, RAG |
| `@designer` | UI/UX, design system, protótipo, Figma |
| `@qa-engineer` | Prova o comportamento de verdade (API/CLI/browser) |
| `@code-reviewer` | Review independente e adversarial |
| `@security-auditor` | Segurança focada em explorabilidade |
| `@debugger` | Causa raiz pelo método científico |
| `@tech-writer` | Docs e memória do projeto |
| `@devops` | Build, CI/CD, ambiente, deploy |
| `@committer` | Único que faz commit, push e PR |

Subagentes não chamam subagentes: cada um devolve um *handoff* com `NEEDS: @agente — pedido` e o Maestro despacha na hora. Contrato em [.claude/rules/20-delegation.md](.claude/rules/20-delegation.md).

## Auto-melhoria

O harness trata as próprias regras, agentes e skills como código com bug ([regra 85](.claude/rules/85-self-improvement.md)):

1. **Registra** o incidente na hora — você corrigiu o processo, um gate deixou passar, um agente se comportou mal, uma skill não disparou: `node scripts/incident.mjs add …`. O script conta recorrência.
2. **Acha a causa no harness** (qual regra, agente, skill ou brief permitiu) e **corrige ali**.
3. **Prova**: validador passa; agente alterado reroda o cenário em `evals/agents/`; quando dá, vira checagem automática em vez de texto.
4. **Fecha** o incidente e anota no [CHANGELOG.md](CHANGELOG.md).

Corrige sozinho o que deixa o harness mais claro ou mais rígido. **Pergunta antes** de afrouxar autonomia, git, segurança ou permissões. `/retro` faz isso em lote: roda no fim de cada milestone do `/kickoff`, depois de entrega com mais de uma rodada de correção, ou quando você pedir. Correção feita dentro de um projeto fica marcada como "upstream: pending" e o instalador se recusa a sobrescrevê-la.

## Evoluir o harness

1. Novo agente → `/agent-creator`; nova skill → `/skill-architect`; nova regra → arquivo numerado em `.claude/rules/` + índice no `CLAUDE.md`.
2. `node scripts/validate-harness.mjs` (ou `/harness-check`) tem que passar.
3. Skills por stack (React, NestJS, Rails, React Native, deploy, AWS…): `npx @tech-leads-club/agent-skills` dentro do projeto.

## Origem

- Estrutura, fluxo plan → implement → commit, task file, `context/*.md`, templates e as skills `test-generator`, `test-runner`, `security-checker`, `feature-requirement`, `lessons-writer`, `context-generator`: adaptados de [gccintra/gc-harness](https://github.com/gccintra/gc-harness) (repositório sem arquivo de licença — uso pessoal; confirme com o autor antes de redistribuir).
- 13 skills de [tech-leads-club/agent-skills](https://github.com/tech-leads-club/agent-skills) (MIT), conteúdo original (só `name`/`description` ajustados): `coding-guidelines`, `the-fool`, `create-adr`, `create-technical-design-doc`, `security-threat-model`, `security-best-practices`, `docs-writer`, `gh-fix-ci`, `gh-address-comments`, `playwright-skill`, `skill-architect`, `frontend-design`, `tlc-prd`. Outras quatro da mesma origem ficam em `optional/skills/` e são copiadas para `.claude/skills/` do projeto quando fizer falta ([optional/README.md](optional/README.md)): `the-judge`, `the-jury`, `mermaid-studio`, `web-accessibility`.
- Motores de design, instalados uma vez por máquina e usados pelo `/design` ([optional/README.md](optional/README.md)): [taste-skill](https://github.com/Leonxlnx/taste-skill) e [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (ambos MIT). O checklist `.claude/skills/design/references/ui-gate.md` é destilado dos dois.
- Opcionais por projeto: skills de Figma, as quatro de `optional/skills/` acima e as de stack.
- Regras, agentes e skills de pipeline (`retro`, `kickoff`, `discovery`, `design`, `blueprint`, `build`, `audit`, `deliver`, `bugfix`, `hotfix`, `prototype`, `amplify`, `agent-creator`, `harness-check`): escritos para este repositório.
