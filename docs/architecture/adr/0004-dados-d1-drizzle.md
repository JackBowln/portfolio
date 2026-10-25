# ADR-0004 — Dados: Cloudflare D1 com Drizzle ORM

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0005, ADR-0006, ADR-0014, [data-model](../data-model.md), RNF-08, RNF-09

## Contexto

- **D1** é SQLite gerenciado. No Free: 500 MB por banco, 50 queries por invocação, 100 parâmetros por query e Time Travel de 7 dias.
- **Drizzle 0.45.4** é estável (a 1.0 está em RC) e é a versão aceita pelo Better Auth (`^0.45.2`).
- O binding do D1 só existe dentro do request (`event.context.cloudflare.env.DB`).

## Decisão

1. **Bancos.** Um D1 por ambiente (`portfolio-preview`, `portfolio-production`); localmente, o estado do miniflare fica em `.wrangler/state`.
2. **Acesso.**
   - `drizzle-orm/d1` através de `useDb(event)` em `server/utils/db.ts`, que cria a instância a cada request (operação barata) com `casing: 'snake_case'`.
   - Os serviços recebem `db` como parâmetro: são testáveis e não dependem de `event`.
3. **Organização.**
   - Schema em `server/db/schema/*.ts`, um arquivo por domínio (`auth`, `content`, `media`, `taxonomy`, `settings`, `translation`, `system`).
   - Queries em `server/services/<domínio>/*.repo.ts` e regras em `*.service.ts`.
   - Handlers não importam o schema diretamente.
4. **Convenções.**
   - **Nomes:** tabelas em snake_case no plural.
   - **Chaves:** IDs `text` com UUIDv7 gerado na aplicação (ordenável).
   - **Datas:** timestamps em `integer` (`mode: 'timestamp_ms'`), sempre em UTC.
   - **Tipos de coluna:** booleanos com `integer({ mode: 'boolean' })`; JSON em `text({ mode: 'json' })` com schema zod na leitura e na escrita; enums em `text({ enum: [...] })`.
   - **Colunas-padrão:** auditoria em `created_at`, `updated_at`, `created_by`, `updated_by`; exclusão lógica em `deleted_at`.
5. **Integridade.** Foreign keys declaradas (conferir na F02-T1 que estão ativas no D1). Índices para todas as consultas públicas. Unicidade de `(locale, slug)` por tipo de conteúdo.
6. **Limites.**
   - Escritas compostas usam `db.batch([...])`, que é atômico e conta como 1 query no limite de 50.
   - Listas `IN (...)` são divididas para respeitar os 100 parâmetros.
   - Paginação por cursor (`published_at`, `id`).
7. **Migrações.**
   - `drizzle-kit generate` gera SQL em `server/db/migrations/`, aplicado com `wrangler d1 migrations apply DB --local | --remote --env <env>`.
   - Migrações aplicadas nunca são editadas.
   - Mudanças incompatíveis seguem expand/contract em deploys separados.
   - Antes de migrar produção, registrar o bookmark do Time Travel ([ADR-0014](0014-operacao.md)).
   - Migração remota **só com pedido explícito do owner**.
8. **Auth.** As tabelas do Better Auth são geradas pelo CLI dele para Drizzle (`server/db/schema/auth.ts`) e ficam versionadas como qualquer outra.
9. **Seeds.** `server/db/seed/dev.ts` só roda localmente. Conteúdo de exemplo é marcado com `[PLACEHOLDER]` e nunca vai para produção.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| SQL nativo do D1 / Kysely | Menos tipagem ponta a ponta; o Drizzle foi pedido na stack |
| Drizzle 1.0 RC | Não está estável; migrar quando sair (ADR novo) |
| Postgres gerenciado (Neon) ou Turso | Serviço externo adicional; latência fora da borda |
| NuxtHub DB | Abstração extra sobre migrações e bindings ([ADR-0002](0002-plataforma-e-toolchain.md)) |

## Consequências

### Positivas
- Custo zero no volume previsto; leitura próxima do Worker.
- Tipos do banco à interface via schema Drizzle + zod.

### Negativas e custos
- O SQLite tem `ALTER TABLE` limitado, então algumas migrações recriam tabelas (o drizzle-kit gera isso).
- As escritas vão para a região primária do D1 (aceitável: só o admin escreve).

### Riscos e mitigação
- **Estourar 50 queries por invocação em telas do admin:** agregar com `batch` e consultas compostas; testes de integração contam as queries das rotas críticas.

## Validação

- F00-T4: um teste no pool do Workers lê e grava no D1 local com as migrações aplicadas.
- F02-T1: migração inicial aplicada no local e no preview (quando autorizado), com FKs verificadas.

## Referências

- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- Drizzle ORM: driver `d1`, `drizzle-kit generate`
