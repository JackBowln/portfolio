# Onde cada teste vive

| O que está sendo provado | Camada | Pasta | Runner |
|---|---|---|---|
| Função pura (schema zod, segmentador, slugify, guarda de custo, tags de cache, CSP hash, permissões) | unit | `tests/unit/` | Vitest `unit` (node) |
| Componente ou composable (render, ARIA, teclado, `usePageSeo`, `useMotion` com mocks) | componente | `tests/nuxt/` | Vitest `nuxt` (@nuxt/test-utils + happy-dom) |
| Repositório ou serviço com banco/bucket (unicidade, batch atômico, revisões, poda, número de queries) | integração | `tests/workers/` | Vitest `workers` (@cloudflare/vitest-plugin) |
| Contrato HTTP (status, headers, cookies, authz, CSRF, rate limit, upload, cache) | API | `tests/api/` | Playwright `api` (`request`) contra `wrangler dev` |
| Jornada do usuário (J-01…J-08), i18n, sem JS | E2E | `tests/e2e/` | Playwright `e2e` |
| WCAG automatizado | a11y | `tests/a11y/` | Playwright `a11y` + axe |
| Regressão visual | visual | `tests/visual/` | Playwright `toHaveScreenshot` (CI Linux) |
| Orçamento de JS e nota de Lighthouse | perf | `scripts/` | `check:budgets`, `lighthouse` |

## Casos obrigatórios por domínio

Ver `docs/quality/test-strategy.md` §2. Resumo dos que mais falham por esquecimento:

- Meta-teste: **toda** rota em `server/api/admin/**` declara permissão.
- Nenhuma resposta pública com `Set-Cookie`.
- Bundle público sem `@tiptap`, `shiki` ou admin.
- GSAP não baixado com movimento reduzido.
- Segmentador: ida e volta = identidade.
- Guarda de custo bloqueia **antes** da chamada.
- Publicação atômica (falha simulada no meio do batch).
- Hreflang recíproco só entre idiomas publicados.

## Quando subir de camada

- O comportamento depende do workerd ou dos bindings reais → `workers` ou `api`.
- Depende de cookies, headers, middleware ou ordem dos plugins do Nitro → `api`.
- Depende de navegador (WebAuthn, foco, View Transitions, Network) → `e2e`.
