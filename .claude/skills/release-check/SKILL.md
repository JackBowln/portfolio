---
name: release-check
description: Revisão de prontidão para deploy de preview ou lançamento em produção deste portfólio — CI, versões, migrações D1 (expand/contract, bookmark de Time Travel), segredos e bindings (só por nome), robots/canonical/sitemap, relatórios de Lighthouse, acessibilidade e segurança, backups, restore, rollback, custos e conteúdo — com resultado go/no-go. Somente leitura, nunca faz deploy. Invoque manualmente com /release-check preview ou /release-check production.
disable-model-invocation: true
argument-hint: "[preview | production]"
---

# Release Check

**Somente leitura.** Esta skill não faz deploy, não aplica migrações, não cria nem altera recursos, segredos ou DNS, e não faz commit. Ela produz um **go/no-go** com evidências. Executar o lançamento é um passo separado, pedido explicitamente pelo owner (F12-T5).

Ambiente alvo: `$ARGUMENTS` (padrão: `preview`).

Fontes:
- `docs/operations/environments.md`, `docs/operations/backup-restore.md`;
- `docs/architecture/adr/0014-operacao.md`;
- [references/release-checklist.md](references/release-checklist.md) e [references/rollback-and-restore.md](references/rollback-and-restore.md).

## Procedimento

1. Identifique a versão candidata (commit, tag) e o diff desde o último release.
2. Percorra o [checklist](references/release-checklist.md) inteiro para o ambiente. Para cada item, registre a **evidência**:
   - comando executado agora e o resumo da saída;
   - link do run do CI;
   - caminho do relatório.
3. Segredos e bindings: confira **só os nomes** (`wrangler secret list --env <env>` e `wrangler.jsonc`). Nunca leia nem imprima valores.
4. Sem evidência, o item fica **"não verificado"**. Nada é presumido aprovado.
5. Classifique: **bloqueador** (no-go), **risco aceito** (precisa da sua confirmação) ou **ok**.

## Saída

```markdown
## Release check — <ambiente> — <commit> — <data>
**Resultado:** GO | NO-GO
### Bloqueadores
| Item | Evidência | Ação necessária |
### Riscos a aceitar (decisão do owner)
| Item | Risco | Mitigação |
### Verificado
| Área | Itens ok | Evidência |
### Não verificado
| Item | Motivo |
### Plano de deploy e rollback (para o owner executar ou autorizar)
1. … (bookmark do Time Travel, migrações, upload, deploy, smoke, purge)
2. Rollback: …
```
