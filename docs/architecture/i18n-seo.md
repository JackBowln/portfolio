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
| Usuário em `/de/blog/artikel` troca para `es`, sem tradução `es` | O seletor leva a `/es/blog` (índice da seção): a página declara os idiomas em que existe (`useLocaleFallback`), e o servidor reescreve os links depois do render (`plugins/locale-switch.server.ts`). Páginas de tema fazem o mesmo para os outros idiomas, até os temas terem slugs traduzidos (F09) |
| Tradução `outdated` | A versão `approved` anterior continua no ar até a nova aprovação (a revisão publicada não muda) |
| Página institucional (home, sobre, contato, privacidade e os textos dos índices) sem tradução publicada | O conteúdo da página usa o pt-BR publicado, marcado `lang="pt-BR"`, com o aviso localizado (`pages.fallbackNotice`); a página leva `noindex` naquele idioma, sem hreflang nem entrada no sitemap até ser traduzida (F08-T2). A interface (menu, rodapé) segue traduzida |

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
| `og:image` de artigos e projetos (F11-T2) | A imagem do idioma no snapshot publicado (gerada no admin ou escolhida à mão), com `og:image:width`, `og:image:height` e `og:image:alt` (o alt da mídia ou o título); sem ela, a OG padrão de `seo_defaults`. O JSON-LD usa a mesma imagem quando não há capa |
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

**Implementação (F11-T1).**
- **Onde é montado:** no servidor (`server/services/seo/jsonld.service.ts`). As respostas públicas trazem o campo `jsonLd` já serializado e escapado, e a página o põe no `<head>` (`useJsonLd`).
- **Breadcrumbs:** o nome do site › a seção (`shared/seo/sections.ts`) › a página.
- **Campos condicionais:**
  - `sameAs` só quando o rodapé mostra as redes;
  - `image` só com capa;
  - um projeto é `SoftwareSourceCode` quando tem repositório.
- **Sem JSON-LD:** contato e privacidade.

## 6. Sitemap e feeds

- `/sitemap.xml`: sitemap único com `xhtml:link` de alternates e `x-default`, servido por endpoint próprio (`server/routes/sitemap.xml.ts`; decisão da F02-T3 no ADR-0008). Desde a F06-T5, lista o índice do blog nos idiomas com artigo e cada artigo publicado, com os alternates dos idiomas publicados e `lastmod` da versão publicada; desde a F07-T2, o índice de projetos e os projetos publicados da mesma forma. A lista de projetos filtrada (`?tech=`) é `noindex`, com o canonical na lista inteira. Os nomes de tecnologia aparecem em pt-BR em todos os idiomas até a F09 (nomes próprios).
- **Entram:** home, índices, artigos, projetos, temas com pelo menos 1 artigo publicado no idioma, sobre, contato e privacidade.
- `lastmod`: `published_at` da revisão publicada; para índices, o mais recente dos itens.
- **Não entram:** `/admin`, `/api`, `/preview`, páginas com `noindex`, paginação além da página 1.
- **Desde a F11-T3:**
  - o `noindex` vem do snapshot publicado;
  - os temas entram nos idiomas em que têm nome aprovado e pelo menos 1 artigo publicado, e a página do tema traz os mesmos idiomas no hreflang;
  - o robots por ambiente está em `shared/seo/robots.ts`.
- RSS 2.0 por idioma em `/rss.xml`, `/en/rss.xml` etc., com os 20 artigos mais recentes, `<link rel="alternate" type="application/rss+xml">` no head do blog e cache tag `rss:{locale}`.

## 7. Mensagens de interface

- Arquivos `i18n/locales/{pt-BR,en,es,de,fr}.json`, com chaves por área: `layout.*`, `home.*`, `blog.*`, `projects.*`, `contact.*`, `errors.*`, `a11y.*` (rótulos de leitores de tela), `admin.*` (só pt-BR na v1, com `en` opcional).
- `pnpm check:i18n` (F02-T2) compara as chaves de todos os idiomas com o pt-BR e falha com chave faltando, chave órfã, tipo diferente (mensagem × grupo), mensagem vazia, interpolações `{x}` diferentes ou número diferente de formas de plural. As chaves `admin.*` podem faltar fora do pt-BR.
- As mensagens chegam ao cliente como arquivos estáticos pré-renderizados em `/_i18n/<hash>/<locale>/messages.json` (o hash é do conteúdo dos arquivos de idioma), com cache `immutable`; o Worker não é executado para elas.
- O plural usa a sintaxe nativa do vue-i18n, com as formas separadas por `|` (`um artigo | {count} artigos`, ou `zero | one | other` com forma própria para zero). A forma é escolhida pelo `Intl.PluralRules` do idioma (`shared/i18n/plural.ts`), seguindo o CLDR: em francês e em português, 0 fica no singular. O `check:i18n` exige o mesmo número de formas em todos os idiomas.
- Datas: `Intl.DateTimeFormat(locale, { dateStyle: 'long' })`; tempo de leitura: `Intl.NumberFormat` + mensagem pluralizada.

## 8. Testes obrigatórios

- Cada página publicada tem canonical para si mesma e hreflang recíproco só entre idiomas publicados (E2E percorrendo o sitemap). Desde a F11-T3: `tests/e2e/seo-crawl.spec.ts`, no build de teste com massa própria, e os feeds RSS validados por parser.
- O seletor de idioma leva à página equivalente ou ao índice.
- Nenhuma resposta pública contém `Set-Cookie` (teste de API).
- O `check:i18n` passa no CI.
- O sitemap é válido (XML bem formado, URLs absolutas, 200 em cada URL).
