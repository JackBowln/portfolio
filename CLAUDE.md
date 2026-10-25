# CLAUDE.md — Portfólio + blog (Nuxt 4 · Cloudflare)

Portfólio profissional e blog pessoal full-stack com CMS próprio:
- **site público:** SSR em cache de borda;
- **admin:** SPA protegida;
- **dados e mídia:** D1 + R2;
- **idiomas:** conteúdo original em pt-BR, com traduções en, es, de e fr assistidas por IA e revisadas por humano.

**Metas:** Lighthouse 100 nas 4 categorias, WCAG 2.2 AA e custo de ~US$ 0 (plano Free).

**Estado:** preparação concluída (docs, ADRs, skills). Próximo passo: **F00** ([roadmap](docs/roadmap/README.md)).

## Onde está cada coisa

| Preciso de… | Leia |
|---|---|
| Requisitos (RF, RX, RNF), rotas, jornadas | [docs/product/PRD.md](docs/product/PRD.md) |
| Decisões e por quê | [docs/architecture/adr/](docs/architecture/adr/README.md) |
| Como as peças se conectam | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Tabelas, estados, invariantes | [docs/architecture/data-model.md](docs/architecture/data-model.md) |
| Segurança e matriz de permissões | [docs/architecture/security-model.md](docs/architecture/security-model.md) |
| Idiomas, rotas traduzidas, SEO | [docs/architecture/i18n-seo.md](docs/architecture/i18n-seo.md) |
| Tarefa atual, critérios e testes | `docs/roadmap/Fxx-*.md` |
| Definition of Done e modelo de relatório | [docs/quality/definition-of-done.md](docs/quality/definition-of-done.md) |
| Versões validadas e limites da Cloudflare | [docs/research/2026-10-25-compatibilidade.md](docs/research/2026-10-25-compatibilidade.md) |

## Stack fixada (não mude major sem ADR)

| Pacote | Versão | Por quê |
|---|---|---|
| Node / pnpm | 24 LTS / 10 | `.nvmrc` e `packageManager` |
| Nuxt / Vue | `~4.6` / 3.5 | Nitro 2.13 + h3 1.15 **via Nuxt**: nunca instale `h3`, `nitropack` ou `nitro` diretamente |
| TypeScript | **`~6.0`** | O TS 7 quebra o `vue-tsc` |
| Tailwind | `~4.3` via `@tailwindcss/vite` | Não usar `@nuxtjs/tailwindcss` |
| Drizzle | orm `~0.45`, kit `~0.31` | Faixa aceita pelo Better Auth |
| Better Auth | `~1.7` + `@better-auth/passkey` | Passkey + GitHub (allowlist); **sem senha** |
| Tiptap | `~3.32` | Só extensões MIT; nunca no bundle público |
| @nuxtjs/i18n | `~10.6` | `customRoutes: 'meta'`, sem detecção por cookie |
| GSAP | `~3.15` | Só sob demanda, depois do LCP (licença no-charge) |
| Vitest | **`~4.1`** | O `@cloudflare/vitest-pool-workers` não suporta a v5 |
| Playwright / axe | `~1.64` / `~4.14` | — |
| Lighthouse | 13 (ferramenta definida no F00-T7) | O `@lhci/cli` embute o Lighthouse 12.6 |
| Wrangler | `^4.152` | Preset Nitro `cloudflare_module` |

Fora da stack, salvo ADR: NuxtHub, Nitro 3, `nuxt-security`, `nuxt-og-image` em runtime, `@nuxt/image`/IPX, qualquer serviço pago.

## Comandos (criados na F00; confira o `package.json`)

`pnpm dev` · `pnpm build` · `pnpm preview` · `pnpm typecheck` · `pnpm lint` · `pnpm lint:fix` · `pnpm test` (unit + nuxt + workers) · `pnpm test:api` · `pnpm test:e2e` · `pnpm test:a11y` · `pnpm lighthouse` · `pnpm check:budgets` · `pnpm check:i18n` · `pnpm db:generate` · `pnpm db:migrate:local` · `pnpm db:seed` · `pnpm cf:types`

## Fronteiras

- `app/` (Vue) ↛ `server/`; `server/` ↛ `app/`; `shared/` é isomórfico e não importa Vue, h3 nem bindings.
- Handlers em `server/api/**` são finos: validar (zod) → autorizar → `server/services/**` → resposta. Queries ficam nos `*.repo.ts`.
- Código de admin (`**/admin/**`, Tiptap, Shiki, codecs WASM) **nunca** entra no bundle público.
- `gsap` e `three` só por `import()` dinâmico em `app/composables/motion/**`.
- Detalhes: [boundaries](.claude/skills/architecture-guardian/references/boundaries.md).

## Workflow obrigatório (toda tarefa)

1. Leia o arquivo da fase e os ADRs citados; inspecione o estado real do repositório.
2. **Antes de editar**, descreva o objetivo, os arquivos afetados, a abordagem, as dependências novas (com justificativa), os testes e os riscos, e **espere aprovação**.
3. Implemente **apenas o escopo aprovado**. Não modifique funcionalidades não relacionadas. Não adicione dependências desnecessárias.
4. Execute `pnpm typecheck`, `pnpm lint` e os testes relevantes. **Nunca declare testes aprovados sem executá-los**; cole o resumo real da saída.
5. Verifique segurança, acessibilidade e performance com as skills da tabela abaixo, conforme a superfície tocada.
6. Atualize o status da tarefa, os ADRs e os docs afetados.
7. Apresente resultados, limitações e mudanças no [modelo de relatório](docs/quality/definition-of-done.md#3-modelo-de-relatório-de-tarefa).

Nunca implemente várias tarefas ou fases numa única alteração.

## Regras invioláveis

- **Servidor decide:** toda rota em `server/api/admin/**` usa `defineAdminHandler` com permissão declarada; validação zod `strict` em todo input; nada de segurança apenas na interface.
- **Sem XSS:** proibido `v-html`. O conteúdo é renderizado pelo renderer com allowlist; URLs são validadas por protocolo; SVG de usuário é bloqueado.
- **Segredos:** nunca no cliente (`runtimeConfig.public`), em log, em teste ou em relatório. Não leia `.dev.vars` nem `.env*`.
- **Cache:** respostas públicas nunca emitem `Set-Cookie` e sempre levam `Cache-Control` + `Cache-Tag` ([ADR-0003](docs/architecture/adr/0003-renderizacao-cache-e-cpu.md)).
- **CPU (Free = 10 ms):** nenhum processamento pesado no request path (imagem, highlighting, OG, Markdown). O trabalho pesado fica no navegador do admin.
- **Sem custo novo:** nenhum serviço ou dependência paga sem ADR e aprovação. IA só via Workers AI; Claude é futuro e opcional ([ADR-0009](docs/architecture/adr/0009-traducao-assistida-por-ia.md)).
- **Ações externas só com pedido explícito:** commit, push, deploy, `--remote`, criação de recursos Cloudflare, segredos, DNS.
- **Conteúdo real:** não invente biografia, métricas, clientes ou depoimentos. Use `[PLACEHOLDER]`.
- **Dados:** migrações aplicadas nunca são editadas; mudanças incompatíveis seguem expand/contract; escritas compostas usam `db.batch`.

## Regras por área

- **i18n:** todo texto visível vem de chaves nos 5 idiomas (`pnpm check:i18n`); datas e números via `Intl`; hreflang só para idiomas publicados. → `/i18n-manager`
- **Performance:** respeite [os orçamentos](docs/quality/performance-budgets.md) (artigo ≤ 100 KB de JS gz); o LCP nunca espera animação; meça antes de afirmar. → `/performance-audit`
- **Acessibilidade:** WCAG 2.2 AA, foco visível, teclado, `alt` por idioma, 0 violações axe sérias ou críticas. → `/frontend-design`, `/test-engineer`
- **Motion:** só o que o storyboard aprovou; com movimento reduzido o GSAP não é baixado; conteúdo visível sem JS; nada de motion no artigo do blog. → `/motion-engineer`
- **Conteúdo/CMS:** o schema do documento em `shared/` é a fonte única; o público lê só snapshots publicados. → `/cms-engineer`

## Skills do projeto

| Skill | Use quando |
|---|---|
| `/architecture-guardian` | Criar módulo, adicionar dependência, mexer em fronteiras, revisar diff |
| `/frontend-design` | Páginas e componentes públicos, layout, tokens, responsividade |
| `/motion-engineer` | Animações, scroll storytelling, transições, SVG e 3D |
| `/cms-engineer` | Modelo de conteúdo, editor, revisões, publicação, preview, mídia, configurações |
| `/i18n-manager` | Textos de interface, rotas traduzidas, tradução por IA, hreflang e sitemap |
| `/security-audit` | Auth, sessão, RBAC, APIs do admin, uploads, embeds, formulários, headers, segredos |
| `/performance-audit` | Medir uma rota, conferir orçamentos, investigar regressões |
| `/test-engineer` | Escrever ou corrigir testes |
| `/release-check` | Só por invocação: prontidão de deploy, migrações, backups (go/no-go) |

`/security-audit` substitui a ideia de um `/security-review` do projeto, porque esse nome sobrescreveria o comando nativo do Claude Code.

## Convenções

- Docs e skills em **pt-BR**; código, identificadores, testes e commits em **inglês**.
- **Branch:** `feat/F03-T2-passkey-github`. **Commits:** Conventional Commits com o ID da tarefa no escopo ou no fim (`feat(auth): … (F03-T2)`).
- Uma tarefa por branch e por PR, com o relatório da DoD na descrição.
