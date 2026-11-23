# Research: outros harnesses de agentes vs. o nosso (2026-11-11)

Método: clone raso e leitura dos arquivos reais (não READMEs). Comparação por **mecanismo**. Só entrou o que fecha uma lacuna nossa.

## Fontes lidas

| Repositório | Licença | O que é |
|-------------|---------|---------|
| [pskoett/self-improving-agent](https://github.com/pskoett/self-improving-agent) | sem arquivo de licença | Skill de auto-melhoria: log de erros/aprendizados, chave de padrão, contagem de recorrência, promoção para regras |
| [github/spec-kit](https://github.com/github/spec-kit) | MIT | Spec-driven: `specify → clarify → plan → tasks → analyze → implement → converge` |
| [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | MIT | Método por papéis (analyst, PM, PO, UX…), retrospectiva, eval de skills |
| [wshobson/agents](https://github.com/wshobson/agents) | MIT | 92 plugins de agentes por domínio, `plugin-eval`, `conductor`, `agent-teams` |

Não lidos (só resultado de busca, **não verificado**): `agent-dev-studios` (URL do resultado não existe), plugins genéricos de woditschka, `epic-harness`, e a afirmação de que um relatório da Anthropic diz que multi-agente não compensa em ~95% das tarefas. Já instalados na máquina e conhecidos: superpowers, GSD, gstack.

## Matriz de lacunas

| Mecanismo | Quem faz bem | Nós antes | Decisão |
|-----------|--------------|-----------|---------|
| Auto-melhoria rastreável | self-improving-agent: entrada estruturada, `Pattern-Key`, recorrência, "recorrência não é prova", nunca afrouxar segurança | Só `/lessons-writer`, para lições do projeto. Nada sobre o próprio harness | **Adotado**: regra 85, `/retro`, `scripts/incident.mjs` |
| Checagem determinística do plano | spec-kit `analyze`: adjetivo vago, placeholder, cobertura, inconsistência | Auto-revisão em prosa no `/blueprint` | **Adotado**: `scripts/validate-task.mjs` |
| Convergência código × intenção | spec-kit `converge` | `@code-reviewer` já confere cobertura de critérios | Já coberto |
| Retrospectiva com evidência | BMAD `bmad-retrospective` | Só "registre lições" no fim do milestone | **Adotado**: `/retro` no fim de cada milestone |
| Eval de skill/agente (gatilho, baseline) | BMAD `bmad-eval`, wshobson `plugin-eval` | `evals/agents/` com 3 cenários, só 1 rodado | Parcial: mantido o nosso; eval de gatilho de skill fica como próximo passo |
| Hooks > prosa (dispara 100%) | comunidade de hooks | 1 hook de sessão | Parcial: hook passou a mostrar incidentes abertos; novos hooks exigem sua aprovação (regra 85) |
| Muitos agentes por domínio | wshobson (92 plugins), agent-dev-studios (38 agentes) | 14 agentes | **Rejeitado**: mais agentes = mais custo de roteamento; nosso Maestro enxuto + skills por stack sob demanda |
| Constituição do projeto | spec-kit `constitution` | `CLAUDE.md` + regras numeradas | Já coberto |
| Decaimento de aprendizado (revalidar por tipo) | self-improving-agent "context decay" | — | **Rejeitado por ora**: pesado demais; reavaliar se o log crescer |

## O que foi provado

- Ciclo completo rodado num defeito real: 5 descrições de skill apontavam para skills inexistentes → incidente registrado → checagem nova no validador (falhou com 7 erros) → correção → validador passa → incidente fechado.
- O próprio `validate-task.mjs` tinha um bug (âncora `\Z` inválida em JS), achado ao testar; registrado e corrigido como segundo incidente.
- Instaladores `.sh` e `.ps1` abortam com código 3 quando o projeto tem correção não portada; `--force` passa.

## Não provado

- `/retro` como skill ainda não rodou de ponta a ponta numa sessão real de projeto.
- A detecção de incidentes depende do modelo perceber e registrar; não há hook que capture sozinho.
