// Own sitemap endpoint (ADR-0008 §5, F02-T3 decision): only indexable, published URLs, with hreflang alternates of the
// published locales. The institutional pages in the locales where they are published (F08-T2: a fallback page is
// noindex, so it stays out); the blog index and the projects index in the locales with a published article or
// project; the published articles (F06-T5) and projects (F07-T2) with their lastmod. Topics and the validating crawl
// come with F11-T3
import { LOCALES } from '#shared/types/enums'
import type { Locale } from '#shared/types/enums'
import { cacheTags } from '#shared/cache/tags'
import { articlePath, projectPath } from '#shared/content/paths'
import { localizedPath } from '#shared/i18n/locales'
import { STATIC_PAGE_PATHS } from '#shared/i18n/routes'
import type { StaticPage } from '#shared/i18n/routes'
import { absoluteUrl } from '#shared/seo/head'
import { buildSitemap } from '#shared/seo/sitemap'
import type { SitemapEntry } from '#shared/seo/sitemap'
import { allPublishedArticles } from '../services/content/blog.repo.ts'
import { publishedPageLocales } from '../services/content/pages.repo.ts'
import { allPublishedProjects } from '../services/content/projects-public.repo.ts'

type Published = { id: string, locale: Locale, slug: string, publishedAt: Date }

const INSTITUTIONAL_PAGES = ['home', 'about', 'contact', 'privacy'] as const

/** One entry per item with its published locales, then its index in the locales that have one */
function publishedEntries(siteUrl: string, rows: readonly Published[], pathOf: (locale: Locale, slug: string) => string, index: StaticPage): SitemapEntry[] {
  const items = new Map<string, { urls: Partial<Record<Locale, string>>, lastmod: Date }>()
  for (const row of rows) {
    const entry = items.get(row.id) ?? { urls: {}, lastmod: row.publishedAt }
    entry.urls[row.locale] = absoluteUrl(siteUrl, pathOf(row.locale, row.slug))
    entry.lastmod = row.publishedAt > entry.lastmod ? row.publishedAt : entry.lastmod
    items.set(row.id, entry)
  }
  const locales = LOCALES.filter(locale => [...items.values()].some(entry => entry.urls[locale]))
  if (locales.length === 0) {
    return []
  }
  const newest = [...items.values()].reduce((latest, entry) => (entry.lastmod > latest ? entry.lastmod : latest), new Date(0))
  return [
    { urls: Object.fromEntries(locales.map(locale => [locale, absoluteUrl(siteUrl, localizedPath(locale, STATIC_PAGE_PATHS[index][locale]))])), lastmod: newest.toISOString() },
    ...[...items.values()].map(entry => ({ urls: entry.urls, lastmod: entry.lastmod.toISOString() })),
  ]
}

export default defineEventHandler(async (event) => {
  const siteUrl = useEnv(event).SITE_URL
  const db = useDb(event)
  const [articles, projects, pages] = await Promise.all([allPublishedArticles(db), allPublishedProjects(db), publishedPageLocales(db, INSTITUTIONAL_PAGES)])
  const entries: SitemapEntry[] = [
    ...INSTITUTIONAL_PAGES.flatMap((page) => {
      const rows = pages.filter(row => row.key === page)
      return rows.length === 0
        ? []
        : [{
            urls: Object.fromEntries(rows.map(row => [row.locale, absoluteUrl(siteUrl, localizedPath(row.locale, STATIC_PAGE_PATHS[page][row.locale]))])),
            lastmod: rows.reduce((latest, row) => (row.publishedAt > latest ? row.publishedAt : latest), new Date(0)).toISOString(),
          }]
    }),
    ...publishedEntries(siteUrl, articles.map(({ articleId, ...row }) => ({ id: articleId, ...row })), articlePath, 'blog'),
    ...publishedEntries(siteUrl, projects.map(({ projectId, ...row }) => ({ id: projectId, ...row })), projectPath, 'projects'),
  ]

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setCachePolicy(event, 'public')
  setCacheTags(event, [cacheTags.sitemap()])
  return buildSitemap(entries)
})
