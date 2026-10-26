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

- `eslint.config.mjs`, com escopos disjuntos por pasta. No flat config, a mesma regra em dois escopos que se sobrepõem é substituída, não somada.
  - **Imports estáticos:** `@typescript-eslint/no-restricted-imports`, com padrões para aliases e caminhos relativos.
    - `app/**` público: proibir `server/` (incluindo o alias `#server`, que o Nuxt 4.6 expõe também no app), `**/admin/**`, `@tiptap/*`, `shiki` e `@jsquash/*`.
    - `gsap` e `three` estáticos ficam proibidos em todo o `app/`, mas `import type` deles é permitido.
    - `app/**/admin/**`, `app/pages/admin/**` e `app/workers/**`: proibir `server/`, `gsap` e `three`.
    - `server/**`: proibir `~`, `@`, `#app`, `#components` e `app/` relativo.
    - `server/api/**`: proíbe também `server/db/schema`.
    - `shared/**`: proibir `vue`, `vue-router`, `h3`, `nitro*`, `nuxt`, `#imports`/`#app`/`#build`/`#server`, `cloudflare:*`, `app/` e `server/`.
  - **`import()` dinâmico:** `no-restricted-syntax`. No público, proíbe `server/`, `admin/`, Tiptap, Shiki e codecs. `gsap` e `three` só passam em `app/composables/motion/**` e `app/components/motion/**`.
  - **Componentes de admin auto-importados** (`<AdminFoo>`, `<LazyAdminFoo>`, `<admin-foo>`) em templates públicos: `vue/no-restricted-syntax`.
  - **Globais em `shared/**`:** `no-restricted-globals` para `process`, `window`, `document`, `navigator`, `localStorage` e `sessionStorage`.
  - **Atenção ao editar:** os padrões seguem a sintaxe do gitignore, em que `#` no início é comentário. Os aliases `#…` precisam ser escapados com `\#` (helper `alias()`).
- Checagem de build (`check:budgets` ou teste dedicado): o manifest das rotas públicas não contém chunks com `tiptap`, `shiki`, `jsquash` ou `admin`.
- Meta-teste: todo arquivo em `server/api/admin/**` exporta um handler criado por `defineAdminHandler` com `permission` definida.

## Sinais de alerta

- Componente público importando um composable de `admin/`.
- `useDb(event)` chamado dentro de um serviço (o serviço deve receber `db`).
- `sql.raw()` ou `sql` com interpolação de entrada.
- `runtimeConfig.public` com algo além de `siteUrl`, `mediaBaseUrl` e `turnstileSiteKey`.
- Lógica de negócio duplicada entre artigos e projetos (deveria estar nos serviços genéricos de conteúdo localizado).
