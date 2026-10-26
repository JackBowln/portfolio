// Own sitemap endpoint (ADR-0008 §5, F02-T3 decision): only indexable, published URLs, with hreflang alternates of the
// published locales. Today the static pages; published content joins in F11-T3
import { LOCALES } from '#shared/types/enums'
import { cacheTags } from '#shared/cache/tags'
import { localizedPath } from '#shared/i18n/locales'
import { INDEXABLE_STATIC_PAGES, STATIC_PAGE_PATHS } from '#shared/i18n/routes'
import { absoluteUrl } from '#shared/seo/head'
import { buildSitemap } from '#shared/seo/sitemap'

export default defineEventHandler((event) => {
  const siteUrl = useEnv(event).SITE_URL
  const entries = INDEXABLE_STATIC_PAGES.map(page => ({
    urls: Object.fromEntries(LOCALES.map(locale => [locale, absoluteUrl(siteUrl, localizedPath(locale, STATIC_PAGE_PATHS[page][locale]))])),
  }))

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setCachePolicy(event, 'public')
  setCacheTags(event, [cacheTags.sitemap()])
  return buildSitemap(entries)
})
