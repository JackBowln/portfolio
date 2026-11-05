# ADR-0003 — Renderização, cache e orçamento de CPU

- **Status:** Aceito (2026-10-25). Gate do spike F00-T6 cumprido em 2026-10-26: **mantido o plano Free** (decisão do owner)
- **Decisores:** Owner · Claude Code
- **Relacionados:** ADR-0002, ADR-0006, ADR-0007, ADR-0012, RNF-01…RNF-05, RNF-08

## Contexto

- **Plano Free:** 10 ms de CPU por requisição (com tolerância para estouros ocasionais), 100 mil requisições por dia, Cron com 10 ms.
- O SSR de Vue/Nuxt num cache-miss pode se aproximar desse limite; hash de senha e processamento de imagem certamente passam dele.
- Os requisitos pedem HTML renderizado para indexação, JS mínimo, Lighthouse 100 e invalidação do cache após publicar.
- **Workers Cache** (novo): cache em camadas antes do Worker.
  - Um hit não executa o Worker nem gera cobrança de CPU.
  - Segue o `Cache-Control` (RFC 9111) e aceita purge por `Cache-Tag` ou prefixo (`ctx.cache.purge`).
  - A chave inclui a versão do Worker, então cada deploy começa com o cache frio, a menos que `cross_version_cache` esteja ligado.
  - Respostas com `Set-Cookie` passam direto.
  - Com ele ligado, requisições a assets estáticos passam a ser cobradas e contadas.
  - A documentação não diz se existe no Free.
- **Cache API:** fica por data center e exige que o Worker rode em todo hit; o purge global por tag é feito pela API da zona.

## Decisão

1. **Páginas públicas em SSR**, com o conteúdo completo no HTML.
   - A hidratação é mínima: componentes estáticos não hidratam (`hydrate-never` / lazy hydration) e o renderer de conteúdo não envia JS.
   - Ilhas interativas só onde necessário: menu, seletor de idioma, formulário, galeria e motion.
2. **Cache de borda com Workers Cache** (`cache.enabled = true` nos ambientes `preview` e `production`).
   - Respostas públicas trazem `Cache-Control` com TTL longo para o cache compartilhado e curto para o navegador. Os valores finais saem do spike.
   - Respostas públicas também trazem `Cache-Tag` com: `site`, `locale:{l}`, `page:{key}:{l}`, `article:{id}`, `article:{id}:{l}`, `project:{id}`, `project:{id}:{l}`, `list:blog:{l}`, `list:projects:{l}`, `tag:{id}`, `settings`, `media:{id}`, `sitemap`, `rss:{l}`, `redirects`.
3. **Purge por evento**, centralizado em `server/utils/cache.ts`:

   | Evento | Tags purgadas |
   |---|---|
   | Publicar ou despublicar um artigo | `article:{id}:{l}`, `list:blog:{l}`, `sitemap`, `rss:{l}` (+ `tag:{id}` dos temas) |
   | Configurações globais | `settings` |
   | Texto alternativo de mídia | `media:{id}` |
   | Redirect | `redirects` |
   | Cron de agendamento | as mesmas tags da publicação |

   Os demais casos seguem o mesmo padrão.
   As tags de artigo são calculadas em `shared/cache/purge.ts` (F06-T4), para a publicação, a despublicação e o cron purgarem o mesmo conjunto; o purge do cron usa o `ExecutionContext` do handler `scheduled` (`purgeCacheTagsIn`).
4. **Disciplina de cookies:** nenhuma resposta pública emite `Set-Cookie`.
   - O i18n roda com `detectBrowserLanguage: false`.
   - A preferência de tema e de movimento reduzido fica em `localStorage`.
   - A sessão só existe em `/admin`, `/api/auth` e `/api/admin`.
5. **Admin como SPA:** `routeRules['/admin/**'] = { ssr: false }`, com `Cache-Control: private, no-store` e `X-Robots-Tag: noindex, nofollow`. O preview usa `private, no-store`.
6. **Orçamento de CPU:**
   - Meta de p95 ≤ 8 ms no SSR em cache-miss (2 ms de folga), medida no spike.
   - Nada de processamento pesado no request path: sem parsing de Markdown, highlighting, processamento de imagem ou geração de imagem OG.
   - O conteúdo é gravado pronto para renderizar: documento validado, HAST de código, sumário e tempo de leitura já calculados.
   - O trabalho pesado roda no navegador do admin ([ADR-0006](0006-conteudo-e-editor.md), [ADR-0007](0007-midia.md)).
7. **Fallbacks, em ordem:**
   1. Sem Workers Cache no Free, ou com a contagem de assets inviável: Cache API num middleware Nitro + purge por tag via API (`CF_API_TOKEN_PURGE`), ou assets servidos de outra origem (`app.cdnURL`).
   2. SSR acima do orçamento de forma consistente: **pedir aprovação ao owner** para o Workers Paid.
   3. Se o Paid for recusado: pré-render das rotas públicas no build, com rebuild disparado na publicação.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| SSG total com rebuild a cada publicação | A publicação leva minutos e consome minutos de CI; fica como fallback 3 |
| SSR sem cache | Risco de CPU em todo request e TTFB pior |
| Nitro `swr` com storage em KV | 1.000 escritas/dia no Free e invalidação por chave interna difícil |
| ISR | Não é nativo no Cloudflare |
| Workers Paid desde já | O owner escolheu começar no Free e decidir com evidência |

## Consequências

### Positivas
- Hits sem CPU e sem cold start; cache global em camadas com colapso de requisições concorrentes.
- Invalidação precisa por entidade e idioma.

### Negativas e custos
- Cada deploy esfria o cache, a menos que `cross_version_cache` esteja ligado (e então é preciso purgar ao mudar templates).
- Disciplina rígida de cookies nas rotas públicas.
- Dependência de um recurso recente da Cloudflare.

### Riscos e mitigação
- **O Free não oferecer Workers Cache:** fallback 1, com custo de CPU baixo por hit (~1 ms).
- **Pico de tráfego (viral) estourar 100 mil requisições por dia:** com assets cacheados no navegador (immutable) e HTML em cache, o risco é aceito; acompanhar no painel.

## Validação

O spike **F00-T6** preenche esta seção com:
- CPU p50/p95 do SSR em miss para home, artigo e lista (via Workers Observability);
- disponibilidade do Workers Cache no Free;
- efeito na contagem de requisições de assets;
- tempo de purge por tag até o reflexo na borda;
- valores finais de `Cache-Control`.

Se algum critério falhar, aplica-se o fallback correspondente e o owner é consultado antes de qualquer custo.

| Medição (F00-T6) | Resultado | Data |
|---|---|---|
| CPU SSR miss p50/p95 — home | p50 **6** / p95 **54** ms (p99 88, máx. 101; 200 requisições). Aquecido: p50 6 / p95 ~15 ms | 2026-10-26 |
| CPU SSR miss p50/p95 — artigo | p50 **25** / p95 **67** ms (p99 78; 200 requisições; ~2.500 palavras, 6 blocos de código em HAST, 5 imagens, documento no payload do `useFetch`). Aquecido: p50 ~22 / p95 ~55 ms. 200 de 200 acima de 10 ms, **nenhum erro 1102** | 2026-10-26 |
| Workers Cache disponível no Free | **Sim.** MISS → HIT com `age` crescente; o HIT **não executa o Worker** (1 MISS e 4 HITs geraram 1 invocação no tail), então a CPU em hit é zero. `ctx.cache` presente | 2026-10-26 |
| Assets contam no limite diário com cache ligado | Os assets não executam o Worker (50 requisições, 0 invocações). A contagem de cobrança foi conferida pelo owner no painel ("tudo em ordem"). Assets com hash saem com `max-age=31536000, immutable` | 2026-10-26 |
| Purge por tag → reflexo | `ctx.cache.purge({ tags })` com `success: true`; a chamada leva 87–465 ms, e o MISS aparece **na primeira consulta (< 1 s)**, em 3 de 3 rodadas. Medido de um único colo (MRS) | 2026-10-26 |

## Referências

- [Workers Cache](https://developers.cloudflare.com/workers/cache/) · [Configuração](https://developers.cloudflare.com/workers/cache/configuration/)
- [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) · [How the cache works](https://developers.cloudflare.com/workers/reference/how-the-cache-works/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

### Decisão após o spike (owner, 2026-10-26)

**Seguir no Workers Free.** Em MISS, o SSR de um artigo passa de 10 ms de CPU, mas com o Workers Cache cada página só renderiza uma vez por publicação, purge ou deploy, e todo o resto é HIT, sem CPU. O Free tolerou os 400 misses seguidos sem erro 1102. Requisitos que viram trabalho nas fases seguintes:

1. **`Cache-Control` das páginas públicas:** `public, max-age=0, s-maxage=604800`, com cache compartilhado de 7 dias e revalidação no navegador. O purge por evento (§3) torna o TTL longo seguro. Implementação na F02-T4.
2. **`cross_version_cache: true` em produção**, para o deploy não esfriar o cache, com purge geral nos deploys que mudarem templates (F11/F12). **Revisto na F11-T4 (owner, 2026-11-04): fica desligado.** Os assets de cada versão saem do ar no deploy, então um HTML de uma versão anterior servido do cache quebraria o JS até o purge. Com o cache frio por deploy, cada página paga um MISS, o que o Free tolerou no spike.
3. **Chave de cache normalizada:** query strings desconhecidas não podem gerar misses. Elas devem ser ignoradas ou redirecionadas para a URL canônica (F11), porque misses em massa são o que pode levar ao 1102.
4. **Renderer sem o documento no payload** (F05). O spike mediu o pior caso, com o documento inteiro serializado pelo `useFetch` (HTML de 155 KB brutos). Remedir a CPU do R3 com o renderer real na F05/F11.
5. **Monitorar o 1102** no Workers Observability. Se aparecer de forma recorrente, aplicam-se os fallbacks 2 e 3 do §7, com consulta ao owner antes de qualquer custo.

**Implementação (F02-T4, 2026-10-26):**
- políticas em `server/utils/cache.ts` (`CACHE_POLICIES`: `public`, `private`, `none`), `setCachePolicy`, `setCacheTags` (valida as tags e o limite de 16 KB do header) e `purgeCacheTags` (via `ctx.cache.purge`, sem efeito onde não há Workers Cache);
- vocabulário de tags em `shared/cache/tags.ts`, usado tanto no header quanto no purge;
- `server/plugins/cache-policy.ts`: página HTML pública sem política própria recebe `public` + a tag `site`; erros e respostas fora das páginas recebem `no-store`; resposta pública com `Set-Cookie` perde o cookie e gera um log de erro;
- `routeRules`: `/api/**` com `no-store`; `/admin/**` e `/api/admin/**` com `private, no-store` e `X-Robots-Tag: noindex, nofollow`.

**Como reproduzir:**
- carga: `node scripts/spikes/ssr-load.mjs --base https://portfolio-preview.vinivdias.workers.dev --path /spike/article --count 200 --label article` (e `--path / --label home`), com query string única por requisição para forçar o miss;
- CPU por requisição: `pnpm exec wrangler tail portfolio-preview --format json` (campos `cpuTime` e `wallTime`), filtrando pelo valor `spike=<label>-<n>`;
- a página do spike foi descartada depois da medição (regra da fase).

**Implementação (F11-T4, 2026-11-04):**
- **Tag `site` em toda resposta pública** (`server/plugins/cache-policy.ts`), menos nos arquivos de mídia imutáveis, que são endereçados por conteúdo. Ela serve ao purge geral (`POST /api/admin/cache/purge`, `settings:update`, auditado como `cache.purged`).
- **Redirects:** os 301 dos middlewares saem antes do `beforeResponse`, então os próprios middlewares acrescentam `site` (o de slug antigo e o de query).
- **Erros e `no-store` não levam tags:** isso vale também para a página de erro que o handler do Nuxt monta depois de uma página lançar um 404 (hook `error`).
- **Eventos sem publicação** em `shared/cache/purge.ts`:

  | Evento | Tags purgadas |
  |---|---|
  | Renomear um tema ou uma tecnologia | `tag:{id}`, `list:blog:{l}` e `list:projects:{l}` dos 5 idiomas, `sitemap` |
  | Metadados de mídia (alt, legenda, crédito, decorativa, ponto focal) | `media:{id}` |
  | Ordem manual dos projetos, ou mudança no destaque de um projeto | `list:projects:{l}` e `page:home:{l}` dos 5 idiomas |
  | Aprovar a tradução de um tema (F11-T3) | `tag:{id}`, `sitemap` |

- **Chave normalizada (decisão 3 do spike):** `server/middleware/02.canonical-query.ts` responde um 301 em cache para a URL sem os parâmetros que a página não lê. Ficam só `page` no blog e nos temas e `tech` em projetos (`shared/seo/canonical-query.ts`).
- **Testes:** `tests/api/cache.spec.ts` varre todas as URLs do sitemap, os dados públicos, feeds, sitemap e robots. Ele exige `Cache-Control` público, `Cache-Tag` válido com `site` e nenhum `Set-Cookie`; confere que erros são `no-store` sem tags; e confere que as páginas afetadas por cada evento levam uma das tags purgadas.
- **Pendente no preview (ação do owner, com deploy autorizado):**
  - publicar e medir o tempo até o reflexo na página e nas listas (meta ≤ 60 s);
  - confirmar um HIT sem execução do Worker (`Cf-Cache-Status: HIT` e nenhuma invocação no tail);
  - registrar os dois nesta seção.
