# Estratégia de testes

Decisão em [ADR-0013](../architecture/adr/0013-testes-e-qualidade.md). A skill `/test-engineer` aplica esta estratégia.

## 1. Camadas

| Camada | Ferramenta | Pasta | O que cobre | Quando roda |
|---|---|---|---|---|
| Unit | Vitest 5 (`unit`, node) | `tests/unit/` | Funções puras de `shared/` e de `server/services/` (schemas, permissões, segmentador, guarda de custo, slugify, máquina de estados, CSP) | Todo PR |
| Componente | Vitest + `@nuxt/test-utils` (`nuxt`, happy-dom) | `tests/nuxt/` | Componentes e composables (renderer, ResponsiveImage, usePageSeo, useMotion com `matchMedia` mockado) | Todo PR |
| Integração com bindings | Vitest + `@cloudflare/vitest-plugin` (`workers`) | `tests/workers/` | Repositórios e serviços contra D1 e R2 reais (miniflare), migrações, `batch`, unicidade, contagem de queries | Todo PR |
| API | Playwright `api` contra o build em `wrangler dev` | `tests/api/` | Handlers HTTP: matriz de autorização, CSRF, rate limit, validação, uploads, headers de cache e segurança, ausência de `Set-Cookie` público | Todo PR |
| E2E | Playwright `e2e` (Chromium desktop, WebKit mobile) | `tests/e2e/` | Jornadas J-01…J-08 do PRD, i18n e seletor de idioma, sem JS (conteúdo presente) | Smoke em PR; completa diária e pré-release |
| Acessibilidade | Playwright `a11y` + `@axe-core/playwright` | `tests/a11y/` | Templates × (pt-BR, de) × (claro, escuro) × movimento reduzido; teclado nos fluxos críticos | Templates afetados em PR; completa diária |
| Visual (_should_) | Playwright `toHaveScreenshot` | `tests/visual/` | Templates-chave em 360, 768 e 1280 px, com movimento reduzido | CI Linux, PRs com rótulo `ui` |
| Performance | Lighthouse 13 (ferramenta da F00-T7) + `check:budgets` | `scripts/`, `reports/` | Rotas-chave × mobile/desktop; orçamento de JS por rota | Orçamentos em todo PR; Lighthouse em PR `ui`, na `main` e pré-release |

## 2. Testes obrigatórios por domínio

| Domínio | Casos mínimos |
|---|---|
| Auth | Passkey registro + login (autenticador virtual); GitHub com ID fora da allowlist rejeitado; bootstrap só sem owner + token, 404 depois; sessão expirada → 401; sessão fresca exigida em ação sensível |
| RBAC | Matriz completa papel × permissão (gerada de `permissions.ts`); meta-teste: toda rota em `server/api/admin/**` declara permissão; `author` não edita conteúdo alheio |
| Segurança HTTP | POST cross-origin → 403; `Content-Type` errado → 415; rate limit → 429; headers presentes por tipo de rota; nenhuma violação de CSP no console |
| Documento | Schema aceita todos os nós válidos e rejeita: nó desconhecido, `javascript:`, atributos extras, HAST com `script`/`on*`, embed fora da allowlist; migradores de `schemaVersion` |
| Renderer | Snapshot por tipo de nó; nenhum `v-html`; heading ids estáveis; bundle público sem `@tiptap` (checagem de build) |
| Publicação | Estados e guardas; publicar cria revisão e ponteiro de forma atômica; slug alterado → redirect; agendamento com relógio falso; purge chamado com as tags certas |
| Revisões | Autosave idêntico não gera revisão; restaurar cria revisão `restore`; poda de autosave; conflito de versão → 409 |
| Mídia | Polyglot, SVG renomeado, MIME divergente e excesso de tamanho rejeitados; exclusão de mídia em uso → 409; variantes do manifesto obrigatórias |
| Tradução | Segmentador: extrair → reinserir = identidade (teste de propriedade); tags inline preservadas; teto de custo bloqueia antes da chamada; `outdated` só nos segmentos alterados; publicação de tradução exige `approved` |
| i18n e SEO | Canonical e hreflang recíproco só entre idiomas publicados; `x-default`; seletor leva à equivalente ou ao índice; sitemap válido; `check:i18n` |
| Motion | Com movimento reduzido o GSAP não é importado; conteúdo visível sem JS; `revert` no unmount |

## 3. Dados, fixtures e mocks

- **Factories** em `tests/factories/` (artigo, projeto, mídia, usuário por papel), com IDs e datas determinísticos.
- **D1 de teste:** migrações aplicadas no setup do projeto `workers`; para `api`/`e2e`, o seed vai para o estado local do `wrangler dev` por script (`pnpm test:seed`).
- **Login em testes:** autenticador WebAuthn virtual para o fluxo real. Para outros papéis, um endpoint de login de teste que **só existe em builds de teste** (flag de build `TEST_AUTH=1`, excluído do build normal por `ignore` do Nitro) e ainda exige `ENVIRONMENT=test`. O `/security-audit` e o `/release-check` verificam que ele não está no output de produção.
- **Provedores externos:**
  - IA: `FakeTranslationProvider` determinístico.
  - GitHub OAuth: mock dos endpoints.
  - Turnstile: chaves de teste oficiais da Cloudflare, uma que sempre passa e outra que sempre falha.
  - Nenhuma chamada real a terceiros em testes.
- **Relógio:** `vi.useFakeTimers()` em agendamento e expiração; nada depende do horário real.

## 4. Cobertura

| Escopo | Meta |
|---|---|
| Permissões, máquina de estados de publicação, segmentador, guarda de custo, validação de upload, schema do documento, CSP | ≥ 90% de branches |
| `server/` e `shared/` em geral | ≥ 70% de linhas |
| Interface | Coberta por E2E, a11y e visual; sem meta de linhas |

## 5. Regras

1. Teste descreve comportamento, não implementação. Nomes em inglês (`it('rejects unknown nodes')`).
2. Nada de `sleep` arbitrário: use esperas por estado (Playwright `expect.poll`, `toBeVisible`).
3. Teste instável é corrigido ou marcado `fixme` com issue e prazo; nunca apagado em silêncio.
4. Toda correção de bug começa por um teste que falha.
5. **Nunca declarar testes aprovados sem executá-los.** O relatório cola o comando e o resumo da saída.

## 6. Scripts previstos (criados na F00)

| Script | Executa |
|---|---|
| `pnpm test` | Os três projetos Vitest |
| `pnpm test:unit` · `test:nuxt` · `test:workers` | Projeto individual |
| `pnpm test:api` · `test:e2e` · `test:a11y` · `test:visual` | Projetos Playwright (constroem e sobem `wrangler dev`) |
| `pnpm test:seed` | Seed determinístico do estado local para API/E2E |
| `pnpm lighthouse` | Ferramenta escolhida no F00-T7 |
| `pnpm check:budgets` | Orçamento de JS por rota |
