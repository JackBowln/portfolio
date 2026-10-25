# Idiomas e rotas — referência rápida

| Código | Prefixo | `og:locale` | Observação |
|---|---|---|---|
| `pt-BR` | — | `pt_BR` | Origem; padrão |
| `en` | `/en` | `en_US` | Alvo do `x-default` quando publicado |
| `es` | `/es` | `es_ES` | — |
| `de` | `/de` | `de_DE` | Formalidade em `ai_translation.style.de` |
| `fr` | `/fr` | `fr_FR` | Requer `latin-ext` na fonte para "œ" |

## Caminhos (`definePageMeta.i18n.paths`)

| Página | pt-BR | en | es | de | fr |
|---|---|---|---|---|---|
| sobre | `/sobre` | `/about` | `/sobre-mi` | `/ueber-mich` | `/a-propos` |
| projetos | `/projetos` | `/projects` | `/proyectos` | `/projekte` | `/projets` |
| projeto | `/projetos/[slug]` | `/projects/[slug]` | `/proyectos/[slug]` | `/projekte/[slug]` | `/projets/[slug]` |
| blog | `/blog` | `/blog` | `/blog` | `/blog` | `/blog` |
| artigo | `/blog/[slug]` | idem | idem | idem | idem |
| tema | `/blog/temas/[slug]` | `/blog/topics/[slug]` | `/blog/temas/[slug]` | `/blog/themen/[slug]` | `/blog/sujets/[slug]` |
| contato | `/contato` | `/contact` | `/contacto` | `/kontakt` | `/contact` |
| privacidade | `/privacidade` | `/privacy` | `/privacidad` | `/datenschutz` | `/confidentialite` |

## Regras de slug

- Minúsculo e ASCII, com hífen como separador, sem pontuação; até ~60 caracteres.
- Transliteração: `ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`, `ç→c`, `ñ→n`, `œ→oe`, `æ→ae`; os demais acentos são removidos.
- Único por idioma e por tipo de conteúdo. Mudar um slug publicado gera um redirect 301 automático.
- O slug traduzido é sugerido pela IA e **sempre editável** na revisão.

## Chaves de interface

- Áreas: `layout.*`, `home.*`, `blog.*`, `projects.*`, `contact.*`, `errors.*`, `a11y.*`, `seo.*`, `admin.*` (admin só em pt-BR na v1, com `en` opcional).
- Nome pelo papel (`blog.readingTime`), não pelo texto.
- Plural ICU: `"{count, plural, one {# minuto de leitura} other {# minutos de leitura}}"`.
- Nunca concatenar frases traduzidas: use interpolação (`{date}`, `{title}`).
