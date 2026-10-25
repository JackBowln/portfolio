# Fronteiras e camadas

## Mapa de pastas

| Pasta | Contém | Pode importar | Não pode importar |
|---|---|---|---|
| `app/` (público) | Páginas, layouts, componentes `ui/`, `layout/`, `content/`, `media/`, `motion/`, composables | `shared/**`, `app/**` público, Vue/Nuxt | `server/**`, `app/**/admin/**`, `@tiptap/*`, `shiki`, `@jsquash/*`; `gsap`/`three` de forma estática |
| `app/**/admin/**`, `app/pages/admin/**`, `app/workers/**` | Telas e lógica do admin (SPA) | Tudo do público + Tiptap, Shiki, codecs, `better-auth/vue` | `server/**` |
| `app/composables/motion/**`, `app/components/motion/**` | Motion | `import('gsap')` e `import('three')` **dinâmicos** | Import estático de `gsap`/`three` |
| `server/api/**` | Handlers HTTP finos | `server/utils/**`, `server/services/**`, `shared/**` | `server/db/schema/**` direto, `app/**` |
| `server/services/<domínio>/` | `*.service.ts` (regras) e `*.repo.ts` (queries Drizzle) | `server/db/**`, `server/utils/**`, `shared/**` | `event` do h3 dentro da lógica (recebe dados e `db` por parâmetro) |
| `server/utils/**`, `server/middleware/**`, `server/plugins/**`, `server/tasks/**`, `server/routes/**` | Infra do servidor | `server/**`, `shared/**` | `app/**` |
| `server/db/` | `schema/`, `migrations/`, `seed/` | `drizzle-orm`, `shared/types` | — |
| `shared/` | Tipos, schemas zod, permissões, locales, tokens, segmentador, helpers de SEO | Só `shared/**` e libs puras (zod) | Vue, h3, Nitro, bindings, `process`, DOM |
| `tests/` | Testes por camada | Qualquer código | — |
| `scripts/` | Scripts de checagem (Node) | `shared/**` | Código de runtime do app |

## Camadas no servidor

```
request → server/middleware (sessão admin, origem/CSRF, rate limit, redirects)
        → server/api/<rota>.ts   defineAdminHandler({ permission, handler })
              1. readValidatedBody/getValidatedQuery (zod strict)
              2. requirePermission + assertOwnership
              3. chama server/services/<domínio>/*.service.ts (recebe db, dados, ator)
              4. auditoria + purge de cache (via utils)
              5. resposta tipada (sem vazar campos internos)
```

- Um handler não tem `if` de regra de negócio: isso vai para o serviço.
- Um serviço não lê headers nem cookies: recebe o que precisa.
- Um repositório não aplica permissão: só executa queries parametrizadas.

## Como impor (implementado na F00-T2)

- ESLint `no-restricted-imports` com `patterns` por glob de arquivo (overrides por pasta):
  - `app/**` (exceto admin): proibir `~~/server/*`, `**/admin/**`, `@tiptap/*`, `shiki`, `@jsquash/*`; proibir `gsap` e `three` como import estático (permitido só em `app/composables/motion/**`, via `import()`).
  - `server/**`: proibir `~/*` e `#app`.
  - `shared/**`: proibir `vue`, `h3`, `nitropack*`, `#imports`.
  - `server/api/**`: proibir `~~/server/db/schema*`.
- Checagem de build (`check:budgets` ou teste dedicado): o manifest das rotas públicas não contém chunks com `tiptap`, `shiki`, `jsquash` ou `admin`.
- Meta-teste: todo arquivo em `server/api/admin/**` exporta um handler criado por `defineAdminHandler` com `permission` definida.

## Sinais de alerta

- Componente público importando um composable de `admin/`.
- `useDb(event)` chamado dentro de um serviço (o serviço deve receber `db`).
- `sql.raw()` ou `sql` com interpolação de entrada.
- `runtimeConfig.public` com algo além de `siteUrl`, `mediaBaseUrl` e `turnstileSiteKey`.
- Lógica de negócio duplicada entre artigos e projetos (deveria estar nos serviços genéricos de conteúdo localizado).
