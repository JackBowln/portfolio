// F06-T5: the public blog over HTTP. Every page, data endpoint and feed is cacheable at the edge with its tags and no
// cookie; the public reads the published snapshot, never the working copy; an article published only in pt-BR is
// absent (404, lists, RSS, sitemap alternates) in the other locales; RSS 2.0 per locale with absolute links
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, APIResponse, PlaywrightWorkerArgs } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { ensureBlogFixture } from '../support/blog'

const ORIGIN = { origin: SITE_ORIGIN }
const unique = () => randomBytes(4).toString('hex')

async function editor(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined) {
  const request = await playwright.request.newContext({ baseURL })
  expect((await request.post('/api/_test/session?role=editor', { headers: ORIGIN })).status()).toBe(200)
  return request
}

/** A pt-BR article published with an excerpt; the slug it answers at */
async function publishedArticle(request: APIRequestContext, title: string): Promise<{ id: string, slug: string }> {
  const created = await request.post('/api/admin/articles', { headers: ORIGIN, data: { title } })
  expect(created.status()).toBe(201)
  const { id, localizations } = await created.json() as { id: string, localizations: { slug: string }[] }
  expect((await request.patch(`/api/admin/articles/${id}`, { headers: ORIGIN, data: { version: 1, excerpt: `Resumo de ${title}` } })).status()).toBe(200)
  expect((await request.post(`/api/admin/articles/${id}/publish`, { headers: ORIGIN, data: { locale: 'pt-BR', version: 2 } })).status()).toBe(200)
  return { id, slug: localizations[0]!.slug }
}

function expectPublic(response: APIResponse, tag: string) {
  expect(response.status(), response.url()).toBe(200)
  const headers = response.headers()
  expect(headers['cache-control'], response.url()).toBe('public, max-age=0, s-maxage=604800')
  expect(headers['cache-tag']?.split(','), response.url()).toContain(tag)
  expect(headers['set-cookie'], response.url()).toBeUndefined()
}

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('pages, data endpoints and feeds are cached at the edge, tagged, and set no cookie', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  const cases: [string, string][] = [
    ['/blog', 'list:blog:pt-BR'],
    ['/de/blog', 'list:blog:de'],
    ['/blog/x', 'list:blog:pt-BR'],
    ['/fr/blog/x', 'list:blog:fr'],
    ['/blog/temas/x', 'list:blog:pt-BR'],
    ['/de/blog/themen/x', 'list:blog:de'],
    ['/api/public/blog?locale=en', 'list:blog:en'],
    ['/api/public/blog/x?locale=es', 'list:blog:es'],
    ['/api/public/blog/topics/x?locale=pt-BR', 'list:blog:pt-BR'],
    ['/rss.xml', 'rss:pt-BR'],
    ['/en/rss.xml', 'rss:en'],
  ]
  for (const [path, tag] of cases) {
    expectPublic(await anonymous.get(path), tag)
  }
  // The article's own tags reach its HTML, so a publish purges exactly its pages
  const article = await (await anonymous.get('/api/public/blog/x?locale=pt-BR')).json() as { cacheTags: string[] }
  const html = await anonymous.get('/blog/x')
  for (const tag of article.cacheTags) {
    expect(html.headers()['cache-tag']?.split(',')).toContain(tag)
  }
})

test('the public reads the published snapshot; an article only in pt-BR is absent elsewhere', async ({ playwright, baseURL }) => {
  const request = await editor(playwright, baseURL)
  const title = `Blog público ${unique()}`
  const { id, slug } = await publishedArticle(request, title)
  // A saved but unpublished change never reaches the site
  expect((await request.patch(`/api/admin/articles/${id}`, { headers: ORIGIN, data: { version: 2, title: 'Rascunho secreto' } })).status()).toBe(200)

  const anonymous = await playwright.request.newContext({ baseURL })
  const data = await (await anonymous.get(`/api/public/blog/${slug}?locale=pt-BR`)).json() as { title: string, excerpt: string, alternates: { locale: string }[] }
  expect(data).toMatchObject({ title, excerpt: `Resumo de ${title}`, alternates: [{ locale: 'pt-BR', slug }] })
  const page = await (await anonymous.get(`/blog/${slug}`)).text()
  expect(page).toContain(title)
  expect(page).not.toContain('Rascunho secreto')
  // Only the published locale is an alternate
  expect(page).toContain('hreflang="pt-BR"')
  expect(page).not.toMatch(new RegExp(`hreflang="en"[^>]*/en/blog/${slug}`))

  for (const path of [`/en/blog/${slug}`, `/api/public/blog/${slug}?locale=en`, `/de/blog/${slug}`]) {
    const response = await anonymous.get(path)
    expect(response.status(), path).toBe(404)
    expect(response.headers()['set-cookie']).toBeUndefined()
  }
  const english = await (await anonymous.get('/api/public/blog?locale=en')).json() as { items: { slug: string }[] }
  expect(english.items.some(item => item.slug === slug)).toBe(false)
  const portuguese = await (await anonymous.get('/api/public/blog?locale=pt-BR')).json() as { items: { slug: string, title: string }[] }
  expect(portuguese.items.find(item => item.slug === slug)?.title).toBe(title)

  const rss = await (await anonymous.get('/rss.xml')).text()
  expect(rss).toContain(`<title>${title}</title>`)
  expect(rss).not.toContain('Rascunho secreto')
  expect(await (await anonymous.get('/en/rss.xml')).text()).not.toContain(title)

  const sitemap = await (await anonymous.get('/sitemap.xml')).text()
  const entry = sitemap.split('<url>').find(block => block.includes(`/blog/${slug}</loc>`))
  expect(entry).toBeDefined()
  expect(entry).not.toContain('hreflang="en"')

  // Unpublished: gone from the page, the list and the feed
  expect((await request.post(`/api/admin/articles/${id}/unpublish`, { headers: ORIGIN, data: { locale: 'pt-BR' } })).status()).toBe(200)
  expect((await anonymous.get(`/blog/${slug}`)).status()).toBe(404)
  expect(await (await anonymous.get('/rss.xml')).text()).not.toContain(title)
  expect(await (await anonymous.get('/sitemap.xml')).text()).not.toContain(`/blog/${slug}</loc>`)
})

test('RSS 2.0 per locale: channel, self link, absolute item links and RFC 822 dates', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  for (const [path, language, blog] of [['/rss.xml', 'pt-BR', '/blog'], ['/de/rss.xml', 'de', '/de/blog'], ['/fr/rss.xml', 'fr', '/fr/blog']] as const) {
    const response = await anonymous.get(path)
    expect(response.headers()['content-type']).toBe('application/rss+xml; charset=utf-8')
    const xml = await response.text()
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">')).toBe(true)
    expect(xml).toContain(`<language>${language}</language>`)
    expect(xml).toMatch(new RegExp(`<link>https?://[^<]+${blog}</link>`))
    expect(xml).toMatch(new RegExp(`<atom:link href="https?://[^"]+${path}" rel="self" type="application/rss\\+xml"/>`))
    const items = xml.split('<item>').slice(1)
    expect(items.length, path).toBeGreaterThan(0)
    expect(items.length).toBeLessThanOrEqual(20)
    for (const item of items) {
      expect(item).toMatch(/<link>https?:\/\/[^<]+\/blog\/[^<]+<\/link>/)
      expect(item).toMatch(/<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT<\/pubDate>/)
    }
  }
  // Only the five locales have a feed; pt-BR lives at the root
  expect((await anonymous.get('/it/rss.xml')).status()).toBe(404)
  expect((await anonymous.get('/pt-BR/rss.xml')).status()).toBe(404)
})

test('pages past the last, unknown slugs and bad input answer 404 or 400 without a cookie', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  for (const [path, status] of [
    ['/blog?page=9999', 404],
    ['/blog?page=abc', 404],
    ['/blog/nao-existe-mesmo', 404],
    ['/blog/temas/nao-existe-mesmo', 404],
    ['/api/public/blog?locale=pt-BR&page=9999', 404],
    ['/api/public/blog/nao-existe-mesmo?locale=pt-BR', 404],
    ['/api/public/blog?locale=it', 400],
    ['/api/public/blog?locale=pt-BR&extra=1', 400],
  ] as const) {
    const response = await anonymous.get(path)
    expect(response.status(), path).toBe(status)
    expect(response.headers()['set-cookie'], path).toBeUndefined()
  }
})
