---
name: i18n-manager
description: Garante traduções, roteamento localizado e SEO multilíngue nos 5 idiomas do portfólio (pt-BR origem; en, es, de, fr) — chaves de interface, rotas e slugs traduzidos, seletor de idioma, formatação com Intl, canonical/hreflang/x-default, Open Graph por idioma, sitemap, RSS e o fluxo de tradução assistida por IA (Workers AI) com revisão humana, custo controlado e detecção de desatualização. Use ao adicionar texto de interface, páginas ou rotas, conteúdo localizado, metadados SEO, ou ao trabalhar na tradução.
when_to_use: "Gatilhos: 'tradução', 'traduzir', 'idioma', 'i18n', 'locale', 'hreflang', 'canonical', 'sitemap', 'RSS', 'slug', 'rota traduzida', 'seletor de idioma', 'texto da interface', 'SEO', 'Open Graph', 'JSON-LD', 'tradução desatualizada', 'glossário', 'Workers AI'."
argument-hint: "[rota | componente | entidade | 'traducao']"
---

# i18n Manager

Fontes de verdade:
- `docs/architecture/i18n-seo.md` (idiomas, rotas, head, JSON-LD, sitemap);
- `docs/architecture/adr/0008-i18n-e-seo.md`;
- `docs/architecture/adr/0009-traducao-assistida-por-ia.md`.

Referências rápidas:
- [locales-and-routes](references/locales-and-routes.md)
- [seo-multilingual](references/seo-multilingual.md)
- [translation-workflow](references/translation-workflow.md)

## Regras

1. **Nenhum texto visível hardcoded.**
   - Chaves em `i18n/locales/{pt-BR,en,es,de,fr}.json`, adicionadas **nos 5 idiomas** no mesmo PR, com plural ICU.
   - `pnpm check:i18n` verde.
   - Traduções de UI escritas no PR passam pela revisão do owner, que pode pedir revisão nativa.
2. **Rotas:** caminhos traduzidos em `definePageMeta({ i18n: { paths } })`, exatamente como a tabela; slugs em ASCII com transliteração; páginas de admin e preview com `i18n: false`.
3. **Links:** `NuxtLinkLocale` (via `UiLocalizedLink`); seletor com `<SwitchLocalePathLink>`; rotas dinâmicas chamam `useSetI18nParams` só com os idiomas publicados.
4. **Formatação:** datas, números e plurais via `Intl` e ICU, com o locale ativo. Nunca formatar manualmente.
5. **SEO:** `usePageSeo()` em toda página; hreflang **só** entre idiomas publicados; `x-default` → `en` se publicado, senão `pt-BR`; canonical absoluto para a própria página; `og:locale` + alternates.
6. **Não traduzido:**
   - artigo, projeto ou tema → não aparece no idioma (404 + fora das listas, do sitemap e do hreflang);
   - página institucional → mostra o pt-BR com aviso + `noindex`.
7. **Cache e cookies:** sem `detectBrowserLanguage`, sem cookie e sem redirect por `Accept-Language`.
8. **Tradução de conteúdo** (fluxo de IA):
   - provedor só **Workers AI**;
   - estimativa e confirmação antes de rodar;
   - teto diário e mensal checado antes de cada chamada;
   - publicação só com `approved` (revisão humana).
   - Detalhes em [translation-workflow](references/translation-workflow.md).

## Verificação

- `pnpm check:i18n`.
- Teste de head (Nuxt/E2E) da rota tocada nos 5 idiomas: canonical, hreflang recíproco, `x-default`, `html lang`.
- A rota existe no sitemap do idioma só se publicada; sem `Set-Cookie` (teste de API).
- Para tradução: o teste do guarda de custo e da ida e volta do segmentador continua verde.

## Relatório

Inclua:
- chaves adicionadas (quantidade por área) e quem revisa os idiomas;
- rotas e slugs afetados;
- resultado dos testes de head e sitemap;
- impacto na tradução (estados e custo estimado, se rodou IA).
