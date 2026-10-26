# ADR-0002 — Plataforma e toolchain: Nuxt 4 em Cloudflare Workers, TypeScript 6

- **Status:** Aceito (2026-10-25)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0003, ADR-0013, RNF-04, RNF-08, RNF-09, F00-T1…T4

## Contexto

- A stack pedida é Nuxt 4, Vue 3, TypeScript, Nitro/H3 e Cloudflare Workers + D1 + R2, com preferência por recursos gratuitos.
- No npm, em 25/10/2026: `nuxt` 4.6.2 (sem Nuxt 5), Nitro 2.13 via `@nuxt/nitro-server` (que depende de `h3 ^1.15`), Nitro 3 em beta, `typescript@latest` 7.0.2 (compilador nativo).
- O `vue-tsc`/Volar ainda não funciona com TS 7, que não expõe a API necessária até o 7.1.
- A Cloudflare recomenda Workers (com Static Assets) para projetos novos, no lugar de Pages.
- O NuxtHub 0.10 virou um módulo multi-provedor e o Admin foi descontinuado.

Detalhes em [compatibilidade](../../research/2026-10-25-compatibilidade.md).

## Decisão

1. **Aplicação.** Um único projeto Nuxt `~4.6`, com a estrutura padrão do Nuxt 4 (`app/`, `server/`, `shared/`) mais `i18n/`, `tests/` e `scripts/` ([overview](../overview.md#3-estrutura-do-repositório-criada-na-f00)).
2. **Deploy.**
   - Nitro com o preset `cloudflare_module`, `cloudflare.deployConfig: true` e `cloudflare.nodeCompat: true`.
   - `wrangler.jsonc` versionado como fonte dos bindings (o Nitro o mescla) e `compatibility_date` fixada na F00-T3.
   - Assets servidos pelos Workers Static Assets.
3. **Desenvolvimento local.** `nuxt dev` com a emulação Cloudflare do Nitro (≥ 2.12, `wrangler` como devDependency) e tipos gerados por `wrangler types`.
4. **Runtime de desenvolvimento.** Node 24 LTS (`.nvmrc`), pnpm 10 (campo `packageManager`), corepack habilitado.
5. **TypeScript `~6.0`** em modo `strict`, com `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`. Typecheck por `nuxi typecheck` (vue-tsc). **Não adotar TS 7** até o vue-tsc suportá-lo oficialmente.
6. **Lint e formatação.** ESLint 10 + `@nuxt/eslint` (flat config com `stylistic`). Sem Prettier.
7. **Não usar:** NuxtHub, Nitro 3, Cloudflare Pages, ou `h3`/`nitropack` instalados diretamente.
8. **Política de versões.**
   - Faixas `~` (só patch) no `package.json` e lockfile commitado.
   - Majors só via ADR.
   - Dependabot (gratuito) para patches e minors semanais; majors avaliados manualmente.
   - Revisão trimestral dos itens marcados com ⚠ na pesquisa de compatibilidade.
9. **Critérios para uma dependência nova:**
   - necessidade real, sem alternativa nativa ou já presente;
   - tamanho no bundle (público ou admin);
   - licença compatível (MIT, Apache-2.0, BSD, ISC ou exceção documentada);
   - compatível com Workers e sem dependência de APIs Node indisponíveis;
   - manutenção ativa (release nos últimos 12 meses).

   O `/architecture-guardian` aplica esse checklist.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Cloudflare Pages | Caminho legado; a recomendação atual é Workers com Static Assets |
| NuxtHub (`@nuxthub/core` 0.10) | Abstração extra sobre bindings e migrações; histórico recente de breaking changes (0.9 → 0.10); Admin descontinuado |
| Nitro 3 / h3 2 | Beta e incompatíveis com o Nuxt 4 |
| TypeScript 7 | Quebra o vue-tsc (typecheck de `.vue`) |
| ESLint + Prettier | Duas ferramentas para o mesmo problema; o `stylistic` cobre a formatação |

## Consequências

### Positivas
- Um deploy, um runtime e bindings nativos (D1, R2, AI, rate limit, cron) sem adaptadores.
- Typecheck confiável de SFCs com o TS 6.

### Negativas e custos
- Ficamos uma major atrás no TypeScript (sem os ganhos de velocidade do TS 7) até o ecossistema Vue alcançar.
- A emulação local não é idêntica ao edge: testes de integração rodam também no workerd ([ADR-0013](0013-testes-e-qualidade.md)).

### Riscos e mitigação
- **Nuxt 5 ou Nitro 3 estável durante o projeto:** só migrar via ADR, depois do lançamento ou em fase própria.
- **Workers muda limites ou preços:** a pesquisa de compatibilidade é revalidada a cada fase.

## Validação

- F00-T1/T2: `pnpm typecheck` e `pnpm lint` passam no esqueleto.
- F00-T3: `nuxt dev` acessa D1 e R2 locais.
- Revisão trimestral: verificar se o TS 7.1 + Volar já suportam Vue, para propor a migração.

| Verificação | Resultado | Data |
|---|---|---|
| F00-T1: `pnpm typecheck` e `pnpm build` no esqueleto | Passam com Nuxt 4.6.2, Nitro 2.13.5, Vite 8.3.5, Vue 3.5.44, TypeScript 6.0.3 e vue-tsc 3.3.13 (Node 24.22.1, pnpm 10.34.8). `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes` estão ativos nos 4 tsconfigs gerados, comprovado por fixtures temporárias que falharam em app, server e shared | 2026-10-25 |
| F00-T2: `pnpm lint` | Passa com ESLint 10.13.0 e `@nuxt/eslint` 1.17.0 (`stylistic`, sem Prettier). As regras de fronteira foram comprovadas por fixtures temporárias: 29 violações detectadas e nenhum falso positivo nos casos permitidos | 2026-10-25 |
| F00-T3: D1 e R2 locais no `nuxt dev` | A rota de diagnóstico, só de dev, grava e lê no D1 e no R2 locais (`getPlatformProxy` do wrangler). O build `cloudflare_module` roda no `wrangler dev` (`/` e `/api/health` respondem 200; as rotas de dev dão 404). **`compatibility_date` = 2026-10-19**, a mais recente aceita pelo `workerd` 1.20261019.1 que vem com o wrangler 4.152; ela fica no `wrangler.jsonc` e em `compatibilityDate.cloudflare` no `nuxt.config.ts`, sempre iguais, e só sobe junto com o wrangler | 2026-10-26 |

## Referências

- [Nitro v2 — Cloudflare](https://v2.nitro.build/deploy/providers/cloudflare)
- [vue-tsc e TypeScript 7](https://github.com/vuejs/language-tools/discussions/6121)
- [NuxtHub database](https://hub.nuxt.com/docs/database)
