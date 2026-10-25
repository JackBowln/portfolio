# ADR-0003 — Renderização, cache e orçamento de CPU

- **Status:** Aceito (2026-10-25), com gate de validação no spike F00-T6
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
| CPU SSR miss p50/p95 — home | _pendente_ | |
| CPU SSR miss p50/p95 — artigo | _pendente_ | |
| Workers Cache disponível no Free | _pendente_ | |
| Assets contam no limite diário com cache ligado | _pendente_ | |
| Purge por tag → reflexo | _pendente_ | |

## Referências

- [Workers Cache](https://developers.cloudflare.com/workers/cache/) · [Configuração](https://developers.cloudflare.com/workers/cache/configuration/)
- [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) · [How the cache works](https://developers.cloudflare.com/workers/reference/how-the-cache-works/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
