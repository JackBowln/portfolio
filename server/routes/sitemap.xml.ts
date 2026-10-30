// Own sitemap endpoint (ADR-0008 §5, F02-T3 decision): only indexable, published URLs, with hreflang alternates of the
// published locales. The indexable static pages, the blog index in the locales with a published article, and the
// published articles with their lastmod (F06-T5); topics, projects and the validating crawl come with F11-T3
import { LOCALES } from '#shared/types/enums'
import type { Locale } from '#shared/types/enums'
import { cacheTags } from '#shared/cache/tags'
import { articlePath } from '#shared/content/paths'
import { localizedPath } from '#shared/i18n/locales'
import { INDEXABLE_STATIC_PAGES, STATIC_PAGE_PATHS } from '#shared/i18n/routes'
import { absoluteUrl } from '#shared/seo/head'
import { buildSitemap } from '#shared/seo/sitemap'
import type { SitemapEntry } from '#shared/seo/sitemap'
import { allPublishedArticles } from '../services/content/blog.repo.ts'

export default defineEventHandler(async (event) => {
  const siteUrl = useEnv(event).SITE_URL
  const entries: SitemapEntry[] = INDEXABLE_STATIC_PAGES.map(page => ({
    urls: Object.fromEntries(LOCALES.map(locale => [locale, absoluteUrl(siteUrl, localizedPath(locale, STATIC_PAGE_PATHS[page][locale]))])),
  }))

  const articles = new Map<string, { urls: Partial<Record<Locale, string>>, lastmod: Date }>()
  for (const row of await allPublishedArticles(useDb(event))) {
    const entry = articles.get(row.articleId) ?? { urls: {}, lastmod: row.publishedAt }
    entry.urls[row.locale] = absoluteUrl(siteUrl, articlePath(row.locale, row.slug))
    entry.lastmod = row.publishedAt > entry.lastmod ? row.publishedAt : entry.lastmod
    articles.set(row.articleId, entry)
  }
  const blogLocales = LOCALES.filter(locale => [...articles.values()].some(entry => entry.urls[locale]))
  if (blogLocales.length > 0) {
    const newest = [...articles.values()].reduce((latest, entry) => (entry.lastmod > latest ? entry.lastmod : latest), new Date(0))
    entries.push({
      urls: Object.fromEntries(blogLocales.map(locale => [locale, absoluteUrl(siteUrl, localizedPath(locale, STATIC_PAGE_PATHS.blog[locale]))])),
      lastmod: newest.toISOString(),
    })
  }
  for (const entry of articles.values()) {
    entries.push({ urls: entry.urls, lastmod: entry.lastmod.toISOString() })
  }

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setCachePolicy(event, 'public')
  setCacheTags(event, [cacheTags.sitemap()])
  return buildSitemap(entries)
})
