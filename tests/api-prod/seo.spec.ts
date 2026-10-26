// F02-T3 against the production-like instance (`pnpm preview:prod`: ENVIRONMENT=production, SITE_URL=localhost:8788)
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

const SITE = 'http://localhost:8788'
const ABOUT = { 'pt-BR': '/sobre', 'en': '/en/about', 'es': '/es/sobre-mi', 'de': '/de/ueber-mich', 'fr': '/fr/a-propos' }
const OG = { 'pt-BR': 'pt_BR', 'en': 'en_US', 'es': 'es_ES', 'de': 'de_DE', 'fr': 'fr_FR' }

interface Head {
  canonical: string | null
  alternates: Record<string, string>
  robots: string | null
  ogLocale: string | null
  lang: string | null
}

async function readHead(page: Page, url: string): Promise<Head> {
  await page.goto(url)
  return page.evaluate(() => ({
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    alternates: Object.fromEntries([...document.querySelectorAll('link[rel="alternate"][hreflang]')]
      .map(link => [link.getAttribute('hreflang'), link.getAttribute('href')])),
    robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
    ogLocale: document.querySelector('meta[property="og:locale"]')?.getAttribute('content') ?? null,
    lang: document.documentElement.getAttribute('lang'),
  }))
}

async function sitemapUrls(request: APIRequestContext, page: Page) {
  const xml = await (await request.get('/sitemap.xml')).text()
  return page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'application/xml')
    if (doc.querySelector('parsererror')) {
      throw new Error('sitemap.xml is not well-formed XML')
    }
    return [...doc.getElementsByTagName('url')].map(url => ({
      loc: url.getElementsByTagName('loc')[0]?.textContent ?? '',
      alternates: Object.fromEntries([...url.getElementsByTagName('xhtml:link')]
        .map(link => [link.getAttribute('hreflang'), link.getAttribute('href')])),
    }))
  }, xml)
}

test('robots.txt allows crawling except private areas and points to the sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt')

  expect(await response.text()).toBe(`User-agent: *\nDisallow: /admin\nDisallow: /api\nDisallow: /preview\n\nSitemap: ${SITE}/sitemap.xml\n`)
  expect(response.headers()['cache-tag']).toBe('robots')
})

test('production responses are indexable and use HSTS', async ({ request }) => {
  for (const path of ['/', '/en/about', '/robots.txt']) {
    const headers = (await request.get(path)).headers()
    expect(headers['x-robots-tag'], path).toBeUndefined()
    expect(headers['strict-transport-security'], path).toBe('max-age=63072000; includeSubDomains')
  }
  // The admin stays out of the index in every environment (routeRules)
  expect((await request.get('/admin')).headers()['x-robots-tag']).toBe('noindex, nofollow')
})

test('the sitemap is valid XML with absolute URLs, alternates and x-default', async ({ request, page }) => {
  const response = await request.get('/sitemap.xml')
  expect(response.headers()['content-type']).toContain('application/xml')
  expect(response.headers()['cache-tag']).toBe('sitemap')

  const urls = await sitemapUrls(request, page)
  expect(urls.map(url => url.loc).sort()).toEqual([
    ...Object.values(ABOUT).map(path => `${SITE}${path}`),
    `${SITE}/`, `${SITE}/de`, `${SITE}/en`, `${SITE}/es`, `${SITE}/fr`,
  ].sort())
  for (const url of urls) {
    expect(Object.keys(url.alternates).sort(), url.loc).toEqual(['de', 'en', 'es', 'fr', 'pt-BR', 'x-default'])
    expect(url.alternates['x-default'], url.loc).toBe(url.alternates.en)
    expect(Object.values(url.alternates).every(href => href?.startsWith(`${SITE}/`)), url.loc).toBe(true)
  }
})

test('every sitemap URL answers 200 with a self canonical and reciprocal hreflang', async ({ request, page }) => {
  for (const url of await sitemapUrls(request, page)) {
    const head = await readHead(page, url.loc)

    expect(head.canonical, url.loc).toBe(url.loc)
    expect(head.robots, url.loc).toBeNull()
    expect(head.alternates, url.loc).toEqual(url.alternates)
    expect(Object.values(head.alternates), url.loc).toContain(url.loc)
  }
})

test('the about page has the right head in every locale', async ({ page }) => {
  for (const [locale, path] of Object.entries(ABOUT)) {
    const head = await readHead(page, path)

    expect(head.lang, locale).toBe(locale)
    expect(head.ogLocale, locale).toBe(OG[locale as keyof typeof OG])
    expect(head.canonical, locale).toBe(`${SITE}${path}`)
    expect(head.alternates['x-default'], locale).toBe(`${SITE}/en/about`)
  }
})

test('noindex skeletons have a canonical but no hreflang', async ({ page }) => {
  for (const path of ['/projetos', '/en/blog', '/de/projekte/x', '/fr/contact']) {
    const head = await readHead(page, path)

    expect(head.robots, path).toBe('noindex')
    expect(head.canonical, path).toBe(`${SITE}${path}`)
    expect(head.alternates, path).toEqual({})
  }
})

test('the canonical drops the query string', async ({ page }) => {
  expect((await readHead(page, '/en/about?utm_source=x')).canonical).toBe(`${SITE}/en/about`)
})

test('the home publishes WebSite and Person JSON-LD with stable ids', async ({ page }) => {
  await page.goto('/en')
  const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}')

  expect(data['@context']).toBe('https://schema.org')
  expect(data['@graph']).toEqual([
    expect.objectContaining({ '@type': 'WebSite', '@id': `${SITE}/#website`, 'inLanguage': 'en' }),
    expect.objectContaining({ '@type': 'Person', '@id': `${SITE}/#person` }),
  ])
})
