// F11-T3: a crawl of the sitemap on the test build, with its own data (the blog fixture in five locales, about in
// pt-BR only, an article published with noindex, a topic in pt-BR only). Every URL answers 200 with a canonical to
// itself, hreflang equal to the sitemap's alternates and no robots meta; what must stay out stays out. The RSS
// feeds are read with an XML parser: RSS 2.0 with its channel and items, and only the articles published in the
// locale, newest first. Pages are fetched and their head parsed in one page, so the crawl stays fast with many URLs
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { articlePath, topicPath } from '../../shared/content/paths'
import { LOCALES } from '../../shared/types/enums'
import type { Locale } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'
import { uniqueName } from '../support/media-api'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'One crawl is enough; it reads HTML, not the layout')
test.setTimeout(180_000)

const ORIGIN = { origin: SITE_ORIGIN }

interface SitemapUrl {
  loc: string
  lastmod: string | null
  alternates: Record<string, string>
}

interface Head {
  canonical: string | null
  alternates: Record<string, string>
  robots: string | null
}

async function sitemap(request: APIRequestContext, page: Page): Promise<SitemapUrl[]> {
  const xml = await (await request.get('/sitemap.xml')).text()
  return page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'application/xml')
    if (doc.querySelector('parsererror')) {
      throw new Error('sitemap.xml is not well-formed XML')
    }
    return [...doc.getElementsByTagName('url')].map(url => ({
      loc: url.getElementsByTagName('loc')[0]?.textContent ?? '',
      lastmod: url.getElementsByTagName('lastmod')[0]?.textContent ?? null,
      alternates: Object.fromEntries([...url.getElementsByTagName('xhtml:link')].map(link => [link.getAttribute('hreflang'), link.getAttribute('href')])),
    }))
  }, xml)
}

const heads = (page: Page, html: string[]) => page.evaluate(sources => sources.map((source) => {
  const doc = new DOMParser().parseFromString(source, 'text/html')
  return {
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    alternates: Object.fromEntries([...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map(link => [link.getAttribute('hreflang'), link.getAttribute('href')])),
    robots: doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
  }
}), html) as Promise<Head[]>

/** Publishes a pt-BR article through the API; `noindex` before the publish */
async function publishArticle(request: APIRequestContext, title: string, changes: Record<string, unknown> = {}) {
  const created = await (await request.post('/api/admin/articles', { headers: ORIGIN, data: { title } })).json() as { id: string }
  const saved = await (await request.patch(`/api/admin/articles/${created.id}`, { headers: ORIGIN, data: { version: 1, excerpt: 'Resumo', ...changes } })).json() as { localizations: { slug: string, version: number }[] }
  expect((await request.post(`/api/admin/articles/${created.id}/publish`, { headers: ORIGIN, data: { locale: 'pt-BR', version: saved.localizations[0]!.version } })).status()).toBe(200)
  return saved.localizations[0]!.slug
}

test('every sitemap URL is indexable, self-canonical and has reciprocal hreflang', async ({ page, request }) => {
  expect((await request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  expect((await request.post('/api/_test/blog-fixture', { headers: ORIGIN })).ok()).toBe(true)
  const hidden = await publishArticle(request, `Fora do mapa ${uniqueName('n', 'x')}`, { noindex: true })
  const topic = await (await request.post('/api/admin/tags', { headers: ORIGIN, data: { kind: 'topic', name: `Tema do mapa ${uniqueName('t', 'x')}` } })).json() as { id: string, slug: string }
  const shown = await publishArticle(request, `No mapa ${uniqueName('s', 'x')}`, { tagIds: [topic.id] })
  await page.goto('/')

  const urls = await sitemap(request, page)
  const site = new URL(urls[0]!.loc).origin
  const locs = urls.map(url => url.loc)
  test.info().annotations.push({ type: 'sitemap URLs crawled', description: String(urls.length) })
  expect(new Set(locs).size, 'one <url> per page').toBe(locs.length)

  // What must be in, and what must stay out
  expect(locs).toContain(`${site}${articlePath('pt-BR', shown)}`)
  expect(locs).toContain(`${site}${topicPath('pt-BR', topic.slug)}`)
  expect(locs).toContain(`${site}/sobre`)
  for (const locale of LOCALES) {
    expect(locs, `topic x in ${locale}`).toContain(`${site}${topicPath(locale, 'x')}`)
  }
  expect(locs).not.toContain(`${site}${articlePath('pt-BR', hidden)}`)
  for (const path of ['/en/about', '/es/sobre-mi', '/de/ueber-mich', '/fr/a-propos']) {
    expect(locs, `about falls back in ${path}`).not.toContain(`${site}${path}`)
  }
  for (const loc of locs) {
    expect(loc, loc).not.toMatch(/[?#]|\/admin|\/api\/|\/preview/)
  }

  // The topic x links its five locales; the new topic only pt-BR, where it has an article
  const topicX = urls.find(url => url.loc === `${site}${topicPath('pt-BR', 'x')}`)!
  expect(Object.keys(topicX.alternates).sort()).toEqual([...LOCALES, 'x-default'].sort())
  expect(Object.keys(urls.find(url => url.loc === `${site}${topicPath('pt-BR', topic.slug)}`)!.alternates).sort()).toEqual(['pt-BR', 'x-default'])

  // The crawl, ten at a time
  for (let start = 0; start < urls.length; start += 10) {
    const batch = urls.slice(start, start + 10)
    const responses = await Promise.all(batch.map(url => request.get(new URL(url.loc).pathname, { headers: { accept: 'text/html' } })))
    responses.forEach((response, index) => expect(response.status(), batch[index]!.loc).toBe(200))
    const read = await heads(page, await Promise.all(responses.map(response => response.text())))
    read.forEach((head, index) => {
      const url = batch[index]!
      expect(head.canonical, url.loc).toBe(url.loc)
      expect(head.robots, url.loc).toBeNull()
      expect(head.alternates, url.loc).toEqual(url.alternates)
      expect(url.lastmod, url.loc).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  }
})

test('the RSS feeds are valid RSS 2.0 with only the articles published in the locale', async ({ page, request }) => {
  expect((await request.post('/api/_test/blog-fixture', { headers: ORIGIN })).ok()).toBe(true)
  await page.goto('/')
  for (const locale of LOCALES) {
    const prefix = locale === 'pt-BR' ? '' : `/${locale}`
    const response = await request.get(`${prefix}/rss.xml`)
    expect(response.status(), locale).toBe(200)
    const feed = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, 'application/xml')
      const text = (parent: Element | Document, name: string) => parent.getElementsByTagName(name)[0]?.textContent ?? null
      const channel = doc.getElementsByTagName('channel')[0]
      return {
        error: doc.querySelector('parsererror') !== null,
        version: doc.documentElement.getAttribute('version'),
        root: doc.documentElement.nodeName,
        title: channel ? text(channel, 'title') : null,
        link: channel ? text(channel, 'link') : null,
        description: channel ? text(channel, 'description') : null,
        language: channel ? text(channel, 'language') : null,
        self: doc.getElementsByTagName('atom:link')[0]?.getAttribute('href') ?? null,
        items: [...doc.getElementsByTagName('item')].map(item => ({ title: text(item, 'title'), link: text(item, 'link'), guid: text(item, 'guid'), pubDate: text(item, 'pubDate') })),
      }
    }, await response.text())

    expect(feed, locale).toMatchObject({ error: false, root: 'rss', version: '2.0', language: locale })
    expect(feed.title && feed.description && feed.link, locale).toBeTruthy()
    expect(feed.self, locale).toMatch(new RegExp(`${prefix}/rss\\.xml$`))
    expect(feed.items.length, locale).toBeGreaterThan(0)
    expect(feed.items.length, locale).toBeLessThanOrEqual(20)
    for (const item of feed.items) {
      expect(item.title && item.guid, locale).toBeTruthy()
      expect(item.link, locale).toMatch(/^https?:\/\//)
      expect(Number.isNaN(Date.parse(item.pubDate ?? '')), `${locale} ${item.pubDate}`).toBe(false)
    }
    const dates = feed.items.map(item => Date.parse(item.pubDate!))
    expect(dates, locale).toEqual([...dates].sort((a, b) => b - a))

    // The same articles as the locale's blog list, in its order
    const slugs: string[] = []
    for (const listPage of [1, 2]) {
      const list = await request.get('/api/public/blog', { params: { locale, page: listPage } })
      if (list.status() === 200) {
        slugs.push(...((await list.json()) as { items: { slug: string }[] }).items.map(item => item.slug))
      }
    }
    expect(feed.items.map(item => new URL(item.link!).pathname), locale).toEqual(slugs.slice(0, 20).map(slug => articlePath(locale as Locale, slug)))
  }
})
