# ADR-0001 — Registrar decisões de arquitetura em ADRs

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** RNF-09, todas as fases

## Contexto

O projeto será implementado por um agente (Claude Code) em dezenas de tarefas pequenas, ao longo de meses. Sem um registro explícito, decisões se perdem entre sessões, são reabertas sem motivo ou contrariadas por mudanças locais. O workflow obrigatório exige arquitetura definida antes de implementar.

## Decisão

1. Decisões com impacto duradouro ficam em `docs/architecture/adr/NNNN-titulo.md`, no formato de [0000-template.md](0000-template.md), em pt-BR.
2. **Exigem ADR novo ou atualização de ADR existente:**
   - nova dependência de runtime, ou troca de uma existente;
   - mudança de versão major de qualquer pacote;
   - novo serviço externo (pago ou não);
   - mudança em invariantes do modelo de dados;
   - mudança na postura de segurança (auth, CSP, permissões);
   - mudança na estratégia de renderização ou cache;
   - qualquer custo recorrente.
3. Um ADR aceito não é reescrito. Para mudar a decisão, cria-se um ADR novo que o substitui, e o antigo recebe o status "Substituído por ADR-NNNN". Correções de digitação e a seção "Validação" (com resultados de spikes) podem ser atualizadas.
4. O Claude Code propõe o ADR dentro da tarefa que precisa dele; o owner aprova na revisão da tarefa. A tarefa só é concluída com o ADR aceito.
5. O índice fica em [README.md](README.md).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Decisões só no CLAUDE.md | O arquivo é carregado em toda sessão e precisa ser curto; perde o contexto e as alternativas |
| Wiki externa | Fica fora do repositório e do alcance do agente |
| Comentários no código | Não registram alternativas nem consequências |

## Consequências

### Positivas
- Sessões novas do Claude Code recuperam o porquê das decisões lendo arquivos versionados.
- A skill `/architecture-guardian` consegue verificar conformidade contra uma fonte única.

### Negativas e custos
- Overhead de escrita em tarefas que mudam decisões.

### Riscos e mitigação
- ADRs desatualizados: a revisão trimestral (ADR-0002) e o `/release-check` conferem se os ADRs ainda refletem o código.

## Validação

Toda PR que adiciona dependência, muda versão major ou altera invariantes cita o ADR correspondente. O `/architecture-guardian` sinaliza quando não cita.

## Referências

- Michael Nygard, "Documenting Architecture Decisions" (2011).
- MADR — Markdown Architectural Decision Records.
