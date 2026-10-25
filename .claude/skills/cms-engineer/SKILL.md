---
name: cms-engineer
description: Cria e evolui o CMS próprio deste portfólio — modelo de conteúdo (artigos, projetos, páginas, temas, mídia, configurações) em D1/Drizzle, schema compartilhado do documento Tiptap, editor do admin, revisões e restauração, publicação, agendamento por cron, preview assinado, renderer público sem v-html e integração com tradução e cache. Use ao mexer em server/services/content, server/api/admin, shared/content, server/db/schema, telas em app/pages/admin ou no ContentRenderer.
when_to_use: "Gatilhos: 'editor', 'Tiptap', 'novo bloco/nó', 'artigo', 'projeto', 'página editável', 'rascunho', 'publicar', 'agendar', 'preview', 'revisão', 'histórico', 'restaurar', 'mídia', 'configurações', 'admin', 'schema de conteúdo', 'migração de conteúdo'."
argument-hint: "[entidade | nó | fluxo]"
---

# CMS Engineer

Fontes de verdade:
- `docs/architecture/data-model.md` (tabelas, estados, invariantes);
- `docs/architecture/adr/0006-conteudo-e-editor.md` (documento, editor, renderer);
- `docs/architecture/adr/0007-midia.md`;
- `docs/architecture/adr/0003-renderizacao-cache-e-cpu.md` (tags e purge).

Resumo operacional: [references/content-model.md](references/content-model.md).

## Invariantes (nunca quebrar)

1. O público lê **só** `published_snapshot` e as colunas `published_*`; nunca a cópia de trabalho.
2. Revisões são imutáveis. Restaurar = nova revisão `restore`. Só a poda de autosave apaga.
3. Publicar, restaurar, aprovar e agendar são **atômicos** (`db.batch`) e auditados.
4. Slug publicado alterado → redirect 301 automático.
5. O documento é validado pelo `shared/content/document-schema.ts` no servidor, sempre (`strict`).
6. Nada de processamento pesado no Worker: o highlighting (Shiki), as variantes de imagem e a imagem OG são feitos no navegador do admin. O servidor só valida e grava.
7. Tradução ≠ pt-BR só publica com `approved` e com o pt-BR publicado.
8. Mídia em uso não pode ser excluída.

## Padrão de handler do admin

```ts
export default defineAdminHandler({
  permission: { article: ['publish'] },
  async handler(event, { db, actor }) {
    const params = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, PublishSchema.parse)
    const result = await publishLocalization(db, { ...params, ...body, actor })  // serviço: batch atômico
    await audit(event, { action: 'article.publish', entity: result.ref })
    await purgeTags(event, result.cacheTags)
    return result.public
  },
})
```

O handler é fino; as regras ficam em `server/services/content/*.service.ts` e as queries em `*.repo.ts` (`/architecture-guardian`).

## Fluxos

- **Novo tipo de nó ou bloco:** siga o [new-node-checklist](references/new-node-checklist.md) (6 passos). Não pule o renderer nem o segmentador.
- **Publicação, agendamento, despublicação:** [publishing-state-machine](references/publishing-state-machine.md).
- **Mudança de schema do documento:** incremente `schemaVersion`, crie um migrador puro em `shared/content/migrations/` com teste, e nunca altere documentos em lote sem pedido.
- **Mudança de tabela:** `drizzle-kit generate`, migração nova (nunca editar uma aplicada), expand/contract, e atualize o `data-model.md`.

## Testes mínimos

- Unit: schema e derivados (palavras, TOC, hashes), transições de estado, `slugify`.
- Workers: atomicidade do batch, unicidade de slug, deduplicação e poda de revisões, número de queries da leitura pública (≤ 4).
- API: permissões, validação, 409 de concorrência, preview (expirado e adulterado).
- E2E: J-03, J-04 e J-07 (PRD §10) quando a tarefa tocar nesses fluxos.

## Relatório

Inclua:
- entidades e fluxos afetados;
- migrações criadas;
- invariantes conferidos (com o teste que cobre cada um);
- tags de cache purgadas;
- impacto na tradução (segmentos e estados).
