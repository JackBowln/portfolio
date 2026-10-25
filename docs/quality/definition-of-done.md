# Definition of Done

Vale para **toda tarefa** do [roadmap](../roadmap/README.md). Uma tarefa só é marcada como `concluída` quando todos os itens aplicáveis estão cumpridos e relatados.

## 1. Por tarefa

### Escopo
- [ ] O objetivo, os arquivos afetados e a abordagem foram apresentados **antes** de implementar e aprovados pelo owner.
- [ ] Só o escopo aprovado foi implementado. Nada de refatorações, renomeações ou "melhorias" fora dele.
- [ ] Os critérios de aceite da tarefa estão cumpridos, um a um.

### Verificação (executada, nunca presumida)
- [ ] `pnpm typecheck` sem erros.
- [ ] `pnpm lint` sem erros.
- [ ] Testes relevantes **executados**, com a saída real resumida no relatório (quantos passaram, falharam ou foram pulados).
- [ ] Testes novos cobrem o comportamento novo, conforme a [estratégia de testes](test-strategy.md).
- [ ] Se algum check não pôde rodar, o relatório diz qual, por quê e o risco.

### Qualidade transversal (conforme a superfície tocada)
- [ ] **Segurança:** se tocou auth, sessão, permissões, APIs, uploads, embeds, formulários, headers ou segredos → `/security-audit` no escopo da tarefa, sem achados altos ou críticos abertos.
- [ ] **Acessibilidade:** se tocou interface → axe sem violações sérias ou críticas nos templates afetados, teclado e foco conferidos ([accessibility](accessibility.md)).
- [ ] **Performance:** se tocou interface pública ou motion → `/performance-audit` na rota afetada e orçamentos respeitados ([performance-budgets](performance-budgets.md)).
- [ ] **i18n:** texto novo de interface com chaves nos 5 idiomas e `pnpm check:i18n` verde (a partir da F02-T2).
- [ ] **Arquitetura:** fronteiras respeitadas; dependência nova justificada (`/architecture-guardian`) e ADR criado ou atualizado quando exigido ([ADR-0001](../architecture/adr/0001-registro-de-decisoes.md)).

### Higiene
- [ ] Nenhum segredo, token ou dado pessoal em código, log, teste ou relatório.
- [ ] Nenhum conteúdo inventado (biografia, métricas, clientes, depoimentos); placeholders marcados `[PLACEHOLDER]`.
- [ ] Documentação afetada atualizada (ADRs, data-model, i18n-seo, environments).
- [ ] Status da tarefa atualizado no arquivo da fase.
- [ ] Nenhum commit, push, deploy, migração remota ou alteração de serviço externo **sem pedido explícito**.

## 2. Por fase (gate)

- [ ] Todas as tarefas da fase concluídas ou explicitamente adiadas pelo owner.
- [ ] Gate de saída da fase cumprido (definido no arquivo da fase).
- [ ] Suítes relevantes da fase verdes em execução completa (não só os testes da última tarefa).

## 3. Modelo de relatório de tarefa

```markdown
## Relatório — Fxx-Tn: <título>

**Objetivo:** <uma frase>

**Mudanças**
- `caminho/arquivo` — o que mudou

**Verificação** (comandos executados e resultado real)
- `pnpm typecheck` → ok
- `pnpm lint` → ok
- `pnpm test:unit` → 42 passed, 0 failed
- …

**Segurança / Acessibilidade / Performance**
- <resultado das skills aplicadas, ou "não aplicável: motivo">

**Critérios de aceite**
- [x] critério 1 — evidência
- [ ] critério 2 — pendente: motivo

**Limitações e riscos**
- …

**Próximo passo sugerido**
- …
```
