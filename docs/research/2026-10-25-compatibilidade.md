# Validação de compatibilidade da stack — 25/10/2026

**Método:** versões consultadas no registro npm (`npm view <pacote> version peerDependencies dist-tags`) e limites/preços na documentação oficial, na data acima. Antes de instalar qualquer pacote (F00-T1), confira de novo: versões e planos mudam.

**Como usar este documento:** a coluna "Decisão" é normativa até que um ADR a substitua. Itens marcados com **⚠** exigem atenção ao instalar ou atualizar.

## 1. Versões e decisões

| Pacote / serviço | Versão atual (`latest`) | Decisão | Motivo |
|---|---|---|---|
| `nuxt` | 4.6.2 (sem Nuxt 5 publicado) | `~4.6` | Linha estável atual. Usa Vite 8 (`@nuxt/vite-builder` → `vite ^8.3.4`), Vue `^3.5.44`, Vue Router `^5.4` |
| `nitropack` | 2.13.5 (via `@nuxt/nitro-server` 4.6.2) | Não instalar diretamente | Nitro 3 (`nitro@3.0.x-beta`) ainda é beta e não é usado pelo Nuxt 4 |
| `h3` **⚠** | 2.0.8 é `latest`, mas o Nitro 2.13 depende de `h3 ^1.15.11` | Não instalar diretamente | Instalar `h3@latest` traria a v2, incompatível com os handlers do Nuxt 4 |
| `typescript` **⚠** | 7.0.2 (compilador nativo); 6.0.3 disponível; 7.1.0-beta em 20/10/2026 | `~6.0` | `vue-tsc`/Volar ainda não suportam TS 7, porque dependem da API que só chega no 7.1 |
| `vue-tsc` | 3.3.13 (peer `typescript >=5`) | Usar via `nuxi typecheck` | — |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 | `~4.3` | Integração oficial pelo plugin Vite. O `@nuxtjs/tailwindcss` (6.14) é para a v3 |
| `gsap` | 3.15.0 | `~3.15` | Licença "Standard no-charge" (gratuita, inclui os plugins, não é OSI) |
| `three` | 0.186.1 (MIT) | Só se o storyboard justificar | Peso alto; carregar sob demanda |
| `wrangler` | 4.152.0 | devDependency `^4.152` | Workers Cache exige ≥ 4.69; `cross_version_cache` ≥ 4.107 |
| `@cloudflare/workers-types` | 5.20261025.x | Preferir `wrangler types` | Tipos gerados a partir da configuração real |
| `drizzle-orm` / `drizzle-kit` | 0.45.4 / 0.31.11 (1.0 em RC) | `~0.45` / `~0.31` | Estável e aceito pelo Better Auth (`^0.45.2`). Reavaliar a 1.0 quando sair |
| `better-auth` | 1.7.13 | `~1.7` | Adapter Drizzle, plugin admin/RBAC e rate limit |
| `@better-auth/passkey` | 1.7.13 (usa `@simplewebauthn/server ^13`) | `~1.7` | WebAuthn via WebCrypto, com verificação barata em CPU |
| `@tiptap/*` | 3.32.0 | `~3.32` | DragHandle, UniqueID, TableOfContents e FileHandler viraram MIT (jun/2025) |
| `@nuxtjs/i18n` | 10.6.0 (vue-i18n `^11.4.8`) | `~10.6` | `customRoutes: 'meta'`, `definePageMeta({ i18n: { paths } })`, `useSetI18nParams` |
| `vitest` | 5.0.5; linha 4: 4.1.12 | `~5.0` ([ADR-0015](../architecture/adr/0015-vitest-5-e-vitest-plugin.md)) | O `@cloudflare/vitest-plugin` aceita `^4.1 || ^5`; a decisão inicial (`~4.1`) foi substituída na F00-T4 |
| `@nuxt/test-utils` | 4.3.4 (peer `vitest ^4.0.2 \|\| ^5`) | `~4.3` | Compatível com a 4.1 |
| `@cloudflare/vitest-pool-workers` → `@cloudflare/vitest-plugin` | 0.23.0 (depreciado) → 1.4.7 | `@cloudflare/vitest-plugin ~1.4` | Testes de servidor dentro do workerd, com D1 e R2 reais em miniflare |
| `@playwright/test` / `@axe-core/playwright` | 1.64.1 / 4.14.0 | `~1.64` / `~4.14` | — |
| `@lhci/cli` **⚠** | 0.15.1 (jun/2025) com `lighthouse` 12.6.1 embutido | Não adotar por padrão | O Lighthouse atual é o 13.5; medir com 12.6 diverge do Chrome DevTools/PSI |
| `unlighthouse` | 0.19.1 (`lighthouse ^13.5.0`) | Não adotado (F00-T7) | O script com `lighthouse ~13.5` e `chrome-launcher ~1.2` venceu: presets oficiais, variação visível e menos dependências (ADR-0013) |
| `eslint` / `@nuxt/eslint` | 10.13.0 / 1.17.0 (peer `eslint ^9 \|\| ^10`) | `~10` / `~1.17` | Flat config com `stylistic`, sem Prettier |
| `@nuxt/fonts` | 1.2.0 | `~1.2` | Self-hosting e fallback métrico (evita CLS) |
| `@nuxt/image` | 2.2.0 | Não usar no início | As variantes de mídia são pré-geradas (ADR-0007) |
| `@nuxtjs/sitemap` | 9.1.0 | Avaliar na F02-T3 | Ajuda com alternates de i18n; fonte dinâmica via endpoint |
| `nuxt-schema-org` / `@nuxtjs/robots` | 7.0.1 / 7.0.2 | Não usar no início | JSON-LD e robots são simples de escrever à mão (menos dependências) |
| `nuxt-og-image` | 7.0.7 (Takumi/Satori via WASM) | Não usar em runtime | Custo de CPU no Free; a imagem OG é gerada no admin (ADR-0007) |
| `nuxt-security` | 2.7.0 | Não usar no início | Rate limiter em memória não serve no Workers; o nonce conflita com o cache. Headers via plugin Nitro (ADR-0012) |
| `@nuxthub/core` | 0.10.11 (Admin descontinuado) | Não usar | Bindings diretos com Drizzle; menos abstração e menos risco de breaking change |
| `shiki` | 4.5.0 | No navegador do admin | O HAST gerado é validado no servidor (ADR-0006) |
| `zod` | 4.6.7 | `~4.6` | Mesma major usada pelo Better Auth (`^4.5.4`) |
| `@jsquash/avif` / `@jsquash/webp` | 2.1.1 / 1.5.0 | Candidatos (F04-T2) | Codecs WASM consistentes entre navegadores |
| `@anthropic-ai/sdk` | 1.3.0 | Só no futuro (ADR-0009) | Claude como provedor opcional e pago, com aprovação |
| Node.js | 24 LTS (local: v24.22.1 via nvm; o default do nvm é 22.12.0) | `.nvmrc` = 24; `engines.node` = `^24.15.0` | O `nuxt` 4.6.2 exige `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` |
| pnpm | 10.34.8 (último da linha 10; `latest` = 12.15.0) | `packageManager` = `pnpm@10.34.8` com hash, via corepack | O CLAUDE.md fixa a major 10; o 10.16.0 local só existe no Node 22 |

## 2. Limites da Cloudflare relevantes

| Recurso | Free | Paid (US$ 5/mês) | Impacto no projeto |
|---|---|---|---|
| CPU por requisição HTTP | **10 ms** (tolera estouros ocasionais; uso contínuo é cortado com erro 1102) | 30 s padrão, até 5 min | SSR em cache-miss e hash de senha são os riscos. Login sem senha + cache na borda |
| CPU por Cron Trigger | 10 ms | 30 s / 15 min | O cron de publicação agendada precisa ser enxuto |
| Requisições | 100.000/dia | 10 mi/mês incluídas | Suficiente para um portfólio; tráfego viral é risco aceito |
| Tamanho do Worker | 64 MiB descomprimido, **sem limite comprimido** | Igual | Bundle não é bloqueador, mas o startup (1 s) é |
| Subrequests por requisição | 50 | 10.000 | Atenção em fluxos com muitas chamadas externas |
| Cron Triggers por conta | 5 | 250 | Um cron (`*/5 * * * *`) |
| Assets estáticos | Grátis e ilimitados; 20.000 arquivos, 25 MiB cada | 100.000 arquivos | Com Workers Cache ligado, passam a contar como requisição (ver §3) |
| D1 | 500 MB/banco, 10 bancos, 5 GB/conta, Time Travel 7 dias, 50 queries/invocação, 100 parâmetros/query | 10 GB/banco, Time Travel 30 dias, 1.000 queries/invocação | Usar `db.batch()` (conta como 1 query) |
| R2 | 10 GB-mês, 1 mi classe A, 10 mi classe B, egress grátis | US$ 0,015/GB-mês após o grátis | Sobra para mídia de portfólio |
| Image Transformations | 5.000 únicas/mês; depois disso, erro 9422 (sem cobrança) | +US$ 0,50/1.000 | Não depender disso |
| Workers AI | 10.000 neurons/dia, sem excedente | Mesmos 10.000/dia + US$ 0,011/1.000 neurons | Teto natural de US$ 0 no Free |
| Workers Logs | 200 mil eventos/dia, retenção de 3 dias | 20 mi/mês, retenção de 7 dias | Muda para o preço de Observability em 01/12/2026 |
| Email | Email Routing (receber/encaminhar e enviar para endereço verificado) | Email Sending para qualquer destinatário (beta) | O contato notifica só o seu e-mail verificado |

### Neurons por milhão de tokens (seleção)

| Modelo Workers AI | Entrada | Saída | Estimativa por idioma de um artigo de ~2 mil palavras (≈ 4k tokens de entrada + 4k de saída) |
|---|---|---|---|
| `@cf/openai/gpt-oss-120b` | 31.818 | 68.182 | ≈ 400 neurons (~1.600 para os 4 idiomas, ~6 artigos/dia) |
| `@cf/google/gemma-4-26b-a4b-it` | 9.091 | 27.273 | ≈ 145 neurons (~580 para os 4 idiomas) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 26.668 | 204.805 | ≈ 925 neurons |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 4.625 | 30.475 | ≈ 140 neurons |
| `@cf/meta/m2m100-1.2b` (tradução dedicada) | 31.050 | 31.050 | Qualidade inferior em prosa longa; não preserva marcação |

Os modelos de raciocínio podem gastar mais tokens de saída. O teste de qualidade e custo real é a tarefa F09-T3.

### Referência futura: Claude API (ADR-0009, não adotado agora)

Preços públicos em 06/10/2026: Haiku 5.5 a US$ 0,10/0,50, Sonnet 5.5 a US$ 2/10 e Opus 5.5 a US$ 4/20 por milhão de tokens. O Batch API dá 50% de desconto; o prompt caching reduz o custo da entrada repetida. Estimativa para um artigo de ~2 mil palavras nos 4 idiomas: ≈ US$ 0,01 (Haiku 5.5), US$ 0,19 (Sonnet 5.5) e US$ 0,38 (Opus 5.5). Só entra com sua aprovação e um teto mensal configurado.

## 3. Achados que mudam o desenho

1. **Workers Cache (novo).** Cache em camadas que roda **antes** do Worker: um hit não executa o Worker nem gera cobrança de CPU. Liga com `cache.enabled = true` no wrangler.
   - O purge é feito por `Cache-Tag` (`ctx.cache.purge({ tags })`) ou por prefixo de caminho, e `ctx.cache.invalidate()` marca entradas como velhas.
   - A chave inclui o caminho, o entrypoint e, por padrão, a versão do Worker: cada deploy começa com o cache frio, a menos que `cross_version_cache` esteja ligado.
   - Respostas com `Set-Cookie` ou requisições com `Authorization` passam direto (bypass).
   - Ressalva: com o cache ligado, requisições de assets estáticos passam a ser cobradas e contadas.
   - A documentação não diz se o recurso existe no Free. **Validar no spike F00-T6.** _Validado: existe no Free (F00-T6)._
2. **Cache API (fallback).** É por data center, e o Worker roda em todo hit. O purge global vale para "tudo", tag, host e prefixo, com ressalvas para cache key customizada.
3. **Better Auth no Workers.** O binding do D1 só existe dentro do request, então a instância é criada por request (factory). O hash de senha padrão (scrypt em JS) não cabe em 10 ms de CPU. Por isso: passkey + GitHub, sem senha.
4. **TypeScript 7** saiu em julho de 2026, mas a recomendação para projetos Vue é ficar no 6.0 até o 7.1 e um Volar compatível.
5. **Vitest 5** é o `latest`, mas o pool do Workers ainda está na linha 4.1. Fixar 4.1 para manter um único Vitest no repositório. _Superado na F00-T4: o pool foi substituído pelo `@cloudflare/vitest-plugin`, e o projeto usa Vitest 5 (ADR-0015)._
6. **Lighthouse CI** está parado (jun/2025) e embute o Lighthouse 12.6. Para a meta de 100 medida no Chrome atual (Lighthouse 13), usar uma ferramenta baseada no Lighthouse 13.
7. **Tiptap:** extensões antes pagas viraram MIT. As que continuam pagas (colaboração, IA, conversão, documentos) não serão usadas.
8. **NuxtHub 0.10:** o Admin foi descontinuado e o módulo virou multi-provedor (`@nuxthub/db` com Drizzle e migrações automáticas). Não adotado, para manter controle explícito dos bindings e das migrações.
9. **Workers Free sem limite de bundle comprimido:** o antigo limite de 3 MB não vale mais. O risco agora é o tempo de startup (1 s) e a CPU.

## 4. Pendências de validação prática (spikes)

| Pergunta | Onde | Critério de decisão |
|---|---|---|
| O Workers Cache está disponível no Free? Os assets passam a contar no limite de 100 mil/dia? | F00-T6 | Disponível e com hit sem CPU → adotar. Senão → Cache API + purge por tag via API  **Respondido (F00-T6):** disponível; um HIT não executa o Worker; assets também não executam. |
| Quanta CPU o SSR gasta em cache-miss (p50/p95) numa página representativa? | F00-T6 | p95 ≤ 10 ms (ou estouros só ocasionais) → seguir no Free. Senão → pedir aprovação para o Paid ou cair para pré-render  **Respondido (F00-T6):** home p50 6 / p95 54 ms; artigo p50 25 / p95 67 ms. Free mantido, porque o cache torna os misses raros (ADR-0003). |
| Lighthouse 13 no CI: Unlighthouse ou script próprio? | F00-T7 | Mediana estável em 3 execuções, relatório em artefato, asserção por categoria |
| Passkey do Better Auth funciona no workerd com o RP ID do domínio de preview? | F03-T2 | Registro e login E2E com autenticador virtual |
| O `@cloudflare/vitest-pool-workers` roda os handlers do Nitro com bindings? | F00-T4 | Um teste de integração lê e grava no D1 local  **Respondido na F00-T4:** sim, com o `@cloudflare/vitest-plugin` (D1 do miniflare). |
| Qual modelo do Workers AI traduz melhor pt-BR → de/fr preservando segmentos? | F09-T3 | Avaliação manual de 3 artigos + custo em neurons registrado |

## 5. Política de revalidação

- Antes de cada fase, rode `npm view` nas dependências que a fase vai adicionar e registre aqui qualquer mudança.
- A cada trimestre, revise os itens com **⚠** (TS 7.1/Volar, Lighthouse CI) e atualize os ADRs 0002 e 0013.
- Nenhuma major é atualizada sem ADR.

### Registro

**25/10/2026 — F00-T1 (antes do install).** O `npm view` confirmou `nuxt` 4.6.2, `vue` 3.5.44, `vue-router` 5.4.0, `typescript` 6.0.3 e `vue-tsc` 3.3.13; `nitropack` 2.13.5, `h3` ^1.15.11 e `vite` ^8.3.4 seguem como transitivos. Mudanças e achados:
- **Node:** o `nuxt` 4.6.2 declara `engines.node` `^22.22.3 || ^24.15.0 || >=26.0.0`, e o default do nvm local (22.12.0) fica fora da faixa. Decisão: `engines.node` `^24.15.0` e `engine-strict=true` no `.npmrc`.
- **pnpm:** o `latest` é 12.15.0 (linha 11: 11.28.8). A major 10 foi mantida (CLAUDE.md): `pnpm@10.34.8`, com hash sha512 no `packageManager`, via corepack 0.36 do Node 24.
- **TypeScript:** o 7.1.0-beta saiu em 20/10/2026. O `@nuxt/cli` 4 já aceita o Golar (verificador baseado no typescript-go) como alternativa ao `vue-tsc`; avaliar na revisão trimestral do item ⚠.
- **Peers do `nuxt`:** `rolldown ~1.2.1` é obrigatório e já vem pelo `vite` 8.3.x; `@types/node` e `@parcel/watcher` são opcionais e não foram instalados.
- **tsconfig gerado pelo Nuxt 4.6.2:** `strict` e `noUncheckedIndexedAccess` já vêm ligados; `exactOptionalPropertyTypes` é opt-in. `typescript.tsConfig.compilerOptions` vale para os 4 contextos (app, server, shared, node). Nada está depreciado no TS 6 (`moduleResolution: Bundler`, sem `baseUrl`).
- **`nuxt typecheck`:** roda `vue-tsc -b --noEmit`. Se `typescript` ou `vue-tsc` faltarem, ele oferece instalá-los, o que traria o TS 7; por isso os dois são devDependencies fixadas.
- **Build scripts:** o pnpm 10 bloqueou o do `esbuild` 0.28.2 (transitivo). Dev e build funcionam sem ele; a decisão está em `pnpm.ignoredBuiltDependencies`.
- **`pnpm audit`:** 1 vulnerabilidade alta transitiva, sem versão corrigida: `node-forge` ≤ 1.4.0 (GHSA-86w9-cpqp-85rv / CVE-2026-85393), via `nitropack` → `listhen`. O `listhen` só gera o certificado autoassinado do HTTPS de dev (não verifica assinaturas), e o pacote não entra no output de produção. A exceção no `pnpm audit --audit-level high` do CI é decisão da F00-T5.
- **Depreciado:** `glob` 10.5.0, transitivo via `nitropack` → `archiver`. Sem ação; depende do upstream.

**25/10/2026 — F01-T1.** Seis devDependencies **temporárias**, usadas só pela styleguide de dev (fora do build de produção): `@fontsource-variable/fraunces`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `@fontsource/instrument-serif`, `@fontsource-variable/instrument-sans` e `@fontsource-variable/geist-mono`, todas na 5.3.0 (19/07/2026), sob OFL-1.1 e sem script de instalação. Saem na F01-T3, quando o `@nuxt/fonts` assume o par escolhido.

**25/10/2026 — F00-T2.** O `npm view` confirmou `eslint` 10.13.0 e `@nuxt/eslint` 1.17.0 (06/08/2026). Achados:
- **Peers:** todos os plugins do `@nuxt/eslint-config` aceitam ESLint 10. O `typescript-eslint` 8.72 declara `typescript >=4.8.4 <6.1.0` (mais um motivo para manter o `~6.0`), e o `eslint-plugin-unicorn` 73 exige `eslint >=10.4`.
- **Build scripts:** o do `unrs-resolver` 1.12.2 (resolver do `import-x`) foi bloqueado pelo pnpm 10. O binário pré-compilado (`@unrs/resolver-binding-*`) funciona sem ele, e a decisão está em `pnpm.ignoredBuiltDependencies`.
- **`h3` 2.0.8 transitivo:** vem de `@eslint/config-inspector`, que é só de dev. O runtime segue no `h3` 1.15.11 do Nitro, e nenhum `h3` é instalado diretamente.
- **Hashes de produção:** com o `eslint` instalado, o `vite-plugin-checker` passa a resolver esse peer opcional. Isso muda os caminhos no store do pnpm e, com eles, os ids de CSS scoped das páginas de erro padrão do Nuxt. Os hashes dos chunks mudam sem mudança de conteúdo nem de tamanho, então comparações de orçamento devem olhar tamanhos, não hashes.

**26/10/2026 — F00-T3.** O `wrangler` 4.152.0 (22/10/2026) traz o `workerd` 1.20261019.1, então a `compatibility_date` vai no máximo até **2026-10-19** (registrado no ADR-0002). Achados:
- **Build script:** o do `workerd` foi bloqueado pelo pnpm 10. O binário pré-compilado (`@cloudflare/workerd-*`) funciona sem ele, e a decisão está em `pnpm.ignoredBuiltDependencies`.
- **`no_nodejs_compat_v2`:** com `nodeCompat`, o Nitro 2.13 acrescenta essa flag ao `wrangler.json` gerado, além do `nodejs_compat`. É escolha do preset, que usa os polyfills do unenv; reavaliar se algum pacote exigir o compat v2.
- **Tipos:** o `wrangler types` gera os tipos do runtime (~627 KB) e recomenda `@types/node`. Não foi preciso, porque o typecheck passa sem ele.
- **`ignore` do Nitro:** os padrões de `ignore` valem a partir de `server/` no Nitro, por isso o padrão `**/server/api/_dev/**` não excluía a rota; o certo é `**/_dev/**`.

**26/10/2026 — F00-T4.** Achados:
- **Pool depreciado:** o `@cloudflare/vitest-pool-workers` 0.23.0 foi depreciado e renomeado para `@cloudflare/vitest-plugin`. O 0.23 fixava o wrangler 4.124, com um workerd de agosto. O 1.4.7 usa o wrangler 4.152.0 do projeto e aceita `vitest ^4.1 || ^5`, e o owner escolheu o Vitest 5.0.5 (ADR-0015).
- **AI e conexão remota:** declarar `AI` no ambiente local faz o `nuxt dev` e os testes abrirem uma sessão remota com a conta Cloudflare, porque o Workers AI não tem emulação. O `AI` saiu do topo do `wrangler.jsonc` (fica em preview e produção, e o tipo gerado vira `AI?: Ai`), e os testes usam `remoteBindings: false`.
- **Peers:** o `h3` é peer **opcional** do `@nuxt/test-utils` 4.3.4, então nenhum `h3` é instalado direto.
- **Navegadores do Playwright:** Chrome for Testing 156 e WebKit 27.2, instalados com `pnpm exec playwright install chromium webkit` no cache do usuário. Na F00-T5, o CI precisa rodar `--with-deps`.

**26/10/2026 — F00-T5.** Achados:
- **Actions fixadas por SHA:** `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0, `pnpm/action-setup` v6.1.0 e `actions/upload-artifact` v7.0.2.
- **`pnpm audit`:** o `@cloudflare/vitest-plugin` 1.4.7 fixa `zod` 4.6.5 (GHSA-mrhx-c7xc-m3w5, alta) e um miniflare com `undici` < 7.30.1 (GHSA-xjj6-f33q-929c, alta; GHSA-4qv8-2p9j-2685 e GHSA-f72v-6w45-q472, moderadas). As correções foram aplicadas com `pnpm.overrides` restritos a esses caminhos (`@cloudflare/vitest-plugin>zod: ~4.6.7`, `miniflare>undici: ~7.30.1`), com os testes verdes. **Remover os overrides quando o plugin e o miniflare atualizarem.**
- **Exceção de auditoria:** `pnpm.auditConfig.ignoreGhsas` contém `GHSA-86w9-cpqp-85rv` (`node-forge` ≤ 1.4.0, via `nitropack` → `listhen`), que é só de dev, não tem correção, só gera certificados e não vai para o build. Rever a cada atualização do `nitropack` e remover quando houver versão corrigida.

**26/10/2026 — F00-T7.** O `lighthouse` 13.5.0 (18/09/2026) traz o `@sentry/node`, cuja árvore de OpenTelemetry tem peers desencontrados (`@opentelemetry/api` 1.10 contra `<1.10`). É só aviso, porque a telemetria do Lighthouse vem desligada. O Unlighthouse 0.19.1 foi testado e removido: ele puxa o puppeteer, que tenta baixar um Chrome, e o `@lhci/utils` 0.15. O Lighthouse não audita documentos que não sejam 2xx (`ERRORED_DOCUMENT_REQUEST`), por isso a página 404 fica só no `check:budgets`.

**26/10/2026 — F02-T1.** O `npm view` confirmou `drizzle-orm` 0.45.4 (08/10/2026; a 1.0 está em `rc.5`), `drizzle-kit` 0.31.11 e `zod` 4.6.7, que bate com a pesquisa. O `drizzle-kit` traz o `@esbuild-kit/esm-loader` e o `core-utils`, ambos depreciados, e um `esbuild` ≤ 0.24.2 com o GHSA-67mh-4wv8-2f99 (moderada). Essa falha trata do servidor `serve` do esbuild, que o `drizzle-kit` não usa, e o audit em nível `high` segue limpo. Reavaliar quando o Drizzle 1.0 sair.

**26/10/2026 — F02-T4.** Sem dependências novas. Comportamentos do Nitro 2.13.5 e do Nuxt 4.6.2 confirmados no build em `wrangler dev`: o hook `beforeResponse` não roda quando o error handler responde, então o `Cache-Control` dos 404 vem do próprio handler (`no-cache` em JSON; no HTML, os headers da renderização interna de `/__nuxt_error`, onde o plugin põe `no-store`). Pela mesma razão, o `afterResponse` não roda em erros, e o log da requisição sai no hook `error`. Erros não tratados chegam ao cliente como `{"statusCode":500,"message":"Server Error"}`, mas o handler padrão os registra no console com URL completa e stack. O Nitro gera `.output/public/_headers` a partir das `routeRules` com headers.

**26/10/2026 — F02-T2.** O `npm view` confirmou `@nuxtjs/i18n` 10.6.0 (13/10/2026, MIT), com `vue-i18n` 11.4. Ele declara `h3 ^1.15.11`, que deduplica com o h3 do Nitro (1.15.11); o h3 2.x do lockfile já vinha de ferramentas de dev (`@nuxt/test-utils`, config inspector do ESLint). No 10.6, o cliente busca as mensagens do idioma ativo em `/_i18n/<hash>/<locale>/messages.json` em toda hidratação, mesmo com `experimental.preload`. Com `experimental.prerenderMessages`, o build gera esses arquivos em `.output/public/` e o hash vem do conteúdo dos arquivos de idioma e do `i18n.config.ts`. As mensagens chegam como JSON cru, então `bundle.dropMessageCompiler` não se aplica (economizaria ~4,8 KB). Custo medido: +33 KB gz de JS inicial por rota pública.

**26/10/2026 — F02-T3.** Sem dependências novas; o `@nuxtjs/sitemap` (9.1.0) foi avaliado e preterido por um endpoint próprio (ADR-0008). No preset `cloudflare_module`, o Nitro 2.13 lê as variáveis `NUXT_*` do `env` do Worker em runtime (`globalThis.__env__`), então `NUXT_PUBLIC_SITE_URL` no `wrangler.jsonc` sobrescreve o `runtimeConfig.public.siteUrl` sem novo build. Duas instâncias de `wrangler dev` com o mesmo nome de Worker conflitam no socket interno (`Address already in use (socket "direct:1:default")`); a instância "como produção" usa `--name portfolio-prodlike`. O `wrangler dev --var` sobrescreve as vars do `wrangler.json` gerado.

## 6. Fontes

- Registro npm, consultado em 25/10/2026.
- Cloudflare: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Workers Cache](https://developers.cloudflare.com/workers/cache/) · [Workers Cache configuration](https://developers.cloudflare.com/workers/cache/configuration/) · [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) · [How the cache works](https://developers.cloudflare.com/workers/reference/how-the-cache-works/) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) · [R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Images pricing](https://developers.cloudflare.com/images/pricing/) · [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) · [Rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) · [Email Service](https://developers.cloudflare.com/email-service/)
- Nuxt/Nitro: [Nitro v2 — Cloudflare](https://v2.nitro.build/deploy/providers/cloudflare) · [Nitro tasks](https://nitro.build/docs/tasks) · [NuxtHub database](https://hub.nuxt.com/docs/database) · [Nuxt i18n custom paths](https://i18n.nuxtjs.org/docs/guide/custom-paths) · [Nuxt OG Image renderers](https://www.nuxtseo.com/docs/og-image/renderers)
- Auth: [Better Auth + Nuxt](https://www.better-auth.com/docs/integrations/nuxt) · [Hash de senha no Workers (relato)](https://news.hada.io/topic?id=27399) · [E-mail e senha no Workers](https://flaviocopes.com/native-email-password-authentication-cloudflare-workers/)
- Editor: [Tiptap — open-sourcing more](https://tiptap.dev/blog/release-notes/were-open-sourcing-more-of-tiptap)
- TypeScript: [vue-tsc e TS 7](https://github.com/vuejs/language-tools/discussions/6121) · [Atualizar para TypeScript 7](https://blog.openreplay.com/pt/atualizar-typescript-7/)
- Claude Code: [Skills](https://code.claude.com/docs/en/skills)
- GSAP: licença no campo `license` do pacote npm ("Standard 'no charge' license: https://gsap.com/standard-license").
