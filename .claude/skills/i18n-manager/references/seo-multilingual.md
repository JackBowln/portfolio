# SEO multilíngue — checklist por página

## Head (via `usePageSeo`)

- [ ] `<html lang>` = `language` do idioma ativo.
- [ ] `title`: `seo_title` ou o título, com o modelo de `seo_defaults` do idioma (≤ 60 caracteres recomendado).
- [ ] `meta description`: `seo_description` ou o resumo (120–160 caracteres).
- [ ] `link rel="canonical"`: URL absoluta da própria página (sem query, exceto `page`).
- [ ] `link rel="alternate" hreflang="<l>"` para **cada idioma publicado** da entidade (incluindo o próprio) e recíproco.
- [ ] `hreflang="x-default"`: versão `en` se publicada, senão `pt-BR`.
- [ ] `og:title`, `og:description`, `og:url`, `og:type`, `og:image` (1200×630) + `og:image:alt`, `og:locale` + `og:locale:alternate`.
- [ ] `twitter:card = summary_large_image`.
- [ ] `robots`: `noindex` se `noindex = true`, se for fallback institucional, preview ou fora de produção.
- [ ] Artigos: `article:published_time` e `article:modified_time`.

## JSON-LD (helpers em `shared/seo/jsonld.ts`)

| Template | Tipos |
|---|---|
| Home | `WebSite` + `Person` |
| Sobre | `ProfilePage` (`mainEntity: Person`) |
| Artigo | `BlogPosting` + `BreadcrumbList` |
| Estudo de caso | `CreativeWork` (+ `SoftwareSourceCode` com `codeRepository`) + `BreadcrumbList` |
| Índices | `CollectionPage` + `BreadcrumbList` |

- Só o que é visível na página. Sempre `inLanguage`.
- `@id` estáveis: `${SITE_URL}/#person`, `${SITE_URL}/#website`.
- Serializar escapando `</script>` (teste obrigatório).

## Sitemap e feeds

- Só URLs publicadas e indexáveis, com `alternates` e `lastmod` (`published_at`).
- Temas só com ≥ 1 artigo publicado no idioma. Sem paginação além da página 1.
- RSS por idioma (`/rss.xml`, `/en/rss.xml`…) com os 20 mais recentes, e `<link rel="alternate" type="application/rss+xml">` no blog.

## Testes que provam

- Crawl E2E do sitemap: para cada URL, 200 + canonical para si mesma + hreflang recíproco + nenhum `noindex`.
- Teste de head por idioma nas rotas tocadas.
- Lighthouse SEO = 100 nas rotas-chave.
