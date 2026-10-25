# i18n e SEO multilíngue — especificação

Decisão em [ADR-0008](adr/0008-i18n-e-seo.md). A skill `/i18n-manager` aplica estas regras.

## 1. Idiomas

| Código | `language` (BCP 47) | Prefixo | Papel | `og:locale` |
|---|---|---|---|---|
| `pt-BR` | `pt-BR` | (nenhum) | Origem e padrão | `pt_BR` |
| `en` | `en` | `/en` | Tradução; alvo do `x-default` quando publicada | `en_US` |
| `es` | `es` | `/es` | Tradução | `es_ES` |
| `de` | `de` | `/de` | Tradução | `de_DE` |
| `fr` | `fr` | `/fr` | Tradução | `fr_FR` |

Todos os idiomas são da esquerda para a direita. A fonte precisa cobrir os diacríticos de pt, es, de e fr (subset `latin-ext`).

## 2. Rotas traduzidas (`definePageMeta({ i18n: { paths } })`)

| Arquivo de página | pt-BR | en | es | de | fr |
|---|---|---|---|---|---|
| `pages/index.vue` | `/` | `/` | `/` | `/` | `/` |
| `pages/sobre.vue` | `/sobre` | `/about` | `/sobre-mi` | `/ueber-mich` | `/a-propos` |
| `pages/projetos/index.vue` | `/projetos` | `/projects` | `/proyectos` | `/projekte` | `/projets` |
| `pages/projetos/[slug].vue` | `/projetos/[slug]` | `/projects/[slug]` | `/proyectos/[slug]` | `/projekte/[slug]` | `/projets/[slug]` |
| `pages/blog/index.vue` | `/blog` | `/blog` | `/blog` | `/blog` | `/blog` |
| `pages/blog/[slug].vue` | `/blog/[slug]` | `/blog/[slug]` | `/blog/[slug]` | `/blog/[slug]` | `/blog/[slug]` |
| `pages/blog/temas/[slug].vue` | `/blog/temas/[slug]` | `/blog/topics/[slug]` | `/blog/temas/[slug]` | `/blog/themen/[slug]` | `/blog/sujets/[slug]` |
| `pages/contato.vue` | `/contato` | `/contact` | `/contacto` | `/kontakt` | `/contact` |
| `pages/privacidade.vue` | `/privacidade` | `/privacy` | `/privacidad` | `/datenschutz` | `/confidentialite` |
| `pages/admin/**` | `i18n: false` (não localizado) | | | | |
| `pages/preview/[token].vue` | `i18n: false` | | | | |

Os caminhos não incluem o prefixo; o módulo aplica `/en`, `/es`, `/de` e `/fr`.

**Slugs:**
- Minúsculos, ASCII, com hífens e sem stopwords supérfluas.
- Gerados a partir do título com transliteração (ü→ue, ß→ss, ç→c, acentos removidos).
- Editáveis, e únicos por idioma.

## 3. Política de conteúdo não traduzido

| Situação | Comportamento |
|---|---|
| Artigo publicado em pt-BR, sem `en` aprovado | Não aparece em `/en/blog`, no sitemap `en` nem no hreflang. `/en/blog/<slug-pt>` → 404 |
| Usuário em `/de/blog/artikel` troca para `es`, sem tradução `es` | `<SwitchLocalePathLink>` leva a `/es/blog` (índice da seção) |
| Tradução `outdated` | A versão `approved` anterior continua no ar até a nova aprovação (a revisão publicada não muda) |
| Página institucional (sobre, contato) sem tradução aprovada | O conteúdo da página usa o fallback pt-BR com o aviso "conteúdo disponível em português", e a página leva `noindex` naquele idioma até ser traduzida. A interface (menu, rodapé) segue traduzida |

## 4. Head por página (`usePageSeo`)

| Tag | Regra |
|---|---|
| `<html lang>` | `language` do idioma ativo |
| `<title>` | `seo_title` ou `title`, com o modelo de `seo_defaults` do idioma (por exemplo `%s — Nome`); ≤ 60 caracteres recomendado |
| `meta description` | `seo_description` ou `excerpt`; 120–160 caracteres recomendado |
| `link rel=canonical` | URL absoluta da própria página no idioma ativo (sem query, exceto `page`) |
| `link rel=alternate hreflang` | Uma por idioma **publicado** da entidade, incluindo o próprio; recíprocas |
| `hreflang="x-default"` | Versão `en` se publicada; senão `pt-BR` |
| `og:title`, `og:description`, `og:url`, `og:type` (`website`/`article`/`profile`), `og:image` (1200×630) com `og:image:alt`, `og:locale` + `og:locale:alternate` | Por idioma |
| `twitter:card=summary_large_image` | Sempre |
| `meta robots` | `noindex` quando `noindex = true`, em preview ou fora de produção |
| `article:published_time` / `modified_time` | Artigos |

## 5. JSON-LD por template

| Template | Tipos | Campos-chave |
|---|---|---|
| Home | `WebSite` + `Person` | `name`, `url`, `inLanguage`, `sameAs` (redes), `jobTitle` |
| Sobre | `ProfilePage` com `mainEntity: Person` | `dateModified`, `image` |
| Artigo | `BlogPosting` + `BreadcrumbList` | `headline`, `datePublished`, `dateModified`, `author` (`@id` da Person), `image`, `inLanguage`, `mainEntityOfPage` |
| Estudo de caso | `CreativeWork` (+ `SoftwareSourceCode` com `codeRepository` quando há repositório) + `BreadcrumbList` | `name`, `description`, `image`, `keywords` (tecnologias), `url` |
| Índices | `CollectionPage` + `BreadcrumbList` | `name`, `inLanguage` |

O JSON-LD só descreve o que é visível na página. O `@id` é estável: `${SITE_URL}/#person`, `${SITE_URL}/#website`.

## 6. Sitemap e feeds

- `/sitemap.xml` (índice) e sitemaps por idioma, ou um sitemap único com `xhtml:link` de alternates (decidido na F02-T3 com o `@nuxtjs/sitemap`).
- **Entram:** home, índices, artigos, projetos, temas com pelo menos 1 artigo publicado no idioma, sobre, contato e privacidade.
- `lastmod`: `published_at` da revisão publicada; para índices, o mais recente dos itens.
- **Não entram:** `/admin`, `/api`, `/preview`, páginas com `noindex`, paginação além da página 1.
- RSS 2.0 por idioma em `/rss.xml`, `/en/rss.xml` etc., com os 20 artigos mais recentes, `<link rel="alternate" type="application/rss+xml">` no head do blog e cache tag `rss:{locale}`.

## 7. Mensagens de interface

- Arquivos `i18n/locales/{pt-BR,en,es,de,fr}.json`, com chaves por área: `layout.*`, `home.*`, `blog.*`, `projects.*`, `contact.*`, `errors.*`, `a11y.*` (rótulos de leitores de tela), `admin.*` (só pt-BR na v1, com `en` opcional).
- `pnpm check:i18n` (F02-T2) compara as chaves de todos os idiomas com o pt-BR e falha se faltar alguma ou se houver chave órfã.
- O plural usa sintaxe ICU (`{count, plural, one {# artigo} other {# artigos}}`).
- Datas: `Intl.DateTimeFormat(locale, { dateStyle: 'long' })`; tempo de leitura: `Intl.NumberFormat` + mensagem pluralizada.

## 8. Testes obrigatórios

- Cada página publicada tem canonical para si mesma e hreflang recíproco só entre idiomas publicados (E2E percorrendo o sitemap).
- O seletor de idioma leva à página equivalente ou ao índice.
- Nenhuma resposta pública contém `Set-Cookie` (teste de API).
- O `check:i18n` passa no CI.
- O sitemap é válido (XML bem formado, URLs absolutas, 200 em cada URL).
