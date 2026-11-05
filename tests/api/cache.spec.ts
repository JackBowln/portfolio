// F11-T4 (ADR-0003): the production cache contract over HTTP.
// - Every public response (each sitemap URL, the data it is built from, feeds, sitemap, robots) is cached at the edge
//   with valid tags including `site`, and sets no cookie; errors are never stored.
// - A query a page does not read answers a cached 301 to the URL without it.
// - The full purge is for owner and admin.
// - The writes that change the site without a publish (renaming a topic, a media's metadata, the projects' order or
//   featured flag) purge tags that the affected pages carry.
// Locally there is no Workers Cache, so a purge is a logged no-op: what is checked is that the tags meet
import { expect, test } from '@playwright/test'
import type { APIRequestContext, APIResponse, PlaywrightWorkerArgs } from '@playwright/test'
import { mediaPurgeTags, projectListPurgeTags, tagPurgeTags } from '../../shared/cache/purge'
import { isValidCacheTag } from '../../shared/cache/tags'
import type { Role } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'
import { ensureBlogFixture } from '../support/blog'
import { readyImage, uniqueName } from '../support/media-api'

const ORIGIN = { origin: SITE_ORIGIN }
const PUBLIC = 'public, max-age=0, s-maxage=604800'

async function session(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, role: Role) {
  const request = await playwright.request.newContext({ baseURL })
  expect((await request.post(`/api/_test/session?role=${role}`, { headers: ORIGIN })).status()).toBe(200)
  return request
}

const tagsOf = (response: APIResponse) => (response.headers()['cache-tag'] ?? '').split(',').filter(Boolean)

function expectCached(response: APIResponse) {
  const url = response.url()
  expect(response.status(), url).toBe(200)
  expect(response.headers()['cache-control'], url).toBe(PUBLIC)
  const tags = tagsOf(response)
  expect(tags, url).toContain('site')
  expect(tags.every(isValidCacheTag), url).toBe(true)
  expect(response.headers()['set-cookie'], url).toBeUndefined()
}

/** At least one purged tag is on the response, so the purge reaches it */
function expectReached(response: APIResponse, purged: readonly string[]) {
  expect(tagsOf(response).some(tag => purged.includes(tag)), `${response.url()} carries one of ${purged.join(',')}`).toBe(true)
}

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('every public response is cached with valid tags, site included, and no cookie', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  const xml = await (await anonymous.get('/sitemap.xml')).text()
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]!).pathname)
  expect(paths.length).toBeGreaterThan(10)
  const extra = [
    '/sitemap.xml', '/robots.txt', '/rss.xml', '/de/rss.xml', '/blog?page=1', '/projetos?tech=tecnologia-x',
    '/api/public/settings?locale=pt-BR', '/api/public/pages/home?locale=en', '/api/public/blog?locale=pt-BR',
    '/api/public/blog/x?locale=de', '/api/public/blog/topics/x?locale=fr', '/api/public/projects?locale=es', '/api/public/projects/x?locale=pt-BR',
  ]
  for (let start = 0; start < paths.length + extra.length; start += 10) {
    const batch = [...paths, ...extra].slice(start, start + 10)
    for (const response of await Promise.all(batch.map(path => anonymous.get(path, { headers: { accept: 'text/html' } })))) {
      expectCached(response)
    }
  }

  // Errors and unknown pages are never stored
  for (const path of ['/blog/nao-existe-nunca', '/api/public/blog/nao-existe?locale=pt-BR', '/en/projects/missing-forever']) {
    const response = await anonymous.get(path, { headers: { accept: 'text/html' } })
    expect(response.status(), path).toBe(404)
    expect(response.headers()['cache-control'], path).toBe('no-store')
    expect(response.headers()['cache-tag'], path).toBeUndefined()
  }
})

test('a query the page does not read answers a cached 301 to the URL without it', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  const cases: [string, string][] = [
    ['/?utm_source=x', '/'],
    ['/blog/x?utm_medium=social&ref=1', '/blog/x'],
    ['/blog?page=2&utm_source=x', '/blog?page=2'],
    ['/de/blog/themen/x?page=1&x=1', '/de/blog/themen/x?page=1'],
    ['/projetos?tech=tecnologia-x&page=3', '/projetos?tech=tecnologia-x'],
    ['/blog?page=2&page=3', '/blog?page=2'],
    ['/sobre?', '/sobre'],
  ]
  for (const [from, to] of cases) {
    const response = await anonymous.get(from, { maxRedirects: 0 })
    if (from === '/sobre?') {
      // An empty query is the same URL
      expect(response.status(), from).toBe(200)
      continue
    }
    expect(response.status(), from).toBe(301)
    expect(response.headers().location, from).toBe(to)
    expect(response.headers()['cache-control'], from).toBe(PUBLIC)
    expect(response.headers()['cache-tag'], from).toBe('site')
    expect(response.headers()['set-cookie'], from).toBeUndefined()
  }
  // What the page reads stays, and what is not a page keeps its own query
  for (const path of ['/blog?page=1', '/projetos?tech=tecnologia-x', '/api/public/blog?locale=en', '/api/health?x=1']) {
    expect((await anonymous.get(path, { maxRedirects: 0 })).status(), path).toBe(200)
  }
})

test('the full purge is for owner and admin, audited', async ({ playwright, baseURL }) => {
  for (const role of ['editor', 'author'] as const) {
    expect((await (await session(playwright, baseURL, role)).post('/api/admin/cache/purge', { headers: ORIGIN })).status(), role).toBe(403)
  }
  const anonymous = await playwright.request.newContext({ baseURL })
  expect((await anonymous.post('/api/admin/cache/purge', { headers: ORIGIN })).status()).toBe(401)
  const owner = await session(playwright, baseURL, 'owner')
  const response = await owner.post('/api/admin/cache/purge', { headers: ORIGIN })
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ purged: ['site'] })
  const audit = await (await owner.get('/api/admin/audit?action=cache.purged&limit=5')).json() as { entries: unknown[] }
  expect(audit.entries.length).toBeGreaterThan(0)
})

async function tagId(request: APIRequestContext, slug: string, kind: 'topic' | 'technology' = 'topic') {
  const { items } = await (await request.get('/api/admin/tags', { params: { kind } })).json() as { items: { id: string, slug: string, name: string }[] }
  return items.find(item => item.slug === slug)!
}

test('writes that change the site without a publish purge tags the affected pages carry', async ({ playwright, baseURL }) => {
  const owner = await session(playwright, baseURL, 'owner')
  const anonymous = await playwright.request.newContext({ baseURL })

  // A topic: its page, the articles showing it and the blog lists
  const topic = tagPurgeTags((await tagId(owner, 'x')).id)
  for (const path of ['/blog/temas/x', '/de/blog/themen/x', '/blog/x', '/en/blog/x', '/blog', '/fr/blog', '/sitemap.xml']) {
    expectReached(await anonymous.get(path), topic)
  }
  // The technology of the project x: the project and the project lists (the home follows them)
  const technology = tagPurgeTags((await tagId(owner, 'tecnologia-x', 'technology')).id)
  for (const path of ['/projetos/x', '/es/proyectos/x', '/projetos', '/de/projekte', '/']) {
    expectReached(await anonymous.get(path), technology)
  }
  // The projects' order and featured flag: the lists and the home of every locale
  for (const path of ['/projetos', '/en/projects', '/', '/fr', '/api/public/projects?locale=de']) {
    expectReached(await anonymous.get(path), projectListPurgeTags())
  }

  // A media item: an article published with it as cover carries its tag
  const cover = await readyImage(owner, uniqueName('capa-cache', 'jpg'))
  expect((await owner.patch(`/api/admin/media/${cover}`, { headers: ORIGIN, data: { localizations: { 'pt-BR': { alt: 'Uma capa' } } } })).status()).toBe(200)
  const created = await (await owner.post('/api/admin/articles', { headers: ORIGIN, data: { title: `Com capa ${uniqueName('c', 'x')}` } })).json() as { id: string }
  const saved = await (await owner.patch(`/api/admin/articles/${created.id}`, { headers: ORIGIN, data: { version: 1, excerpt: 'Resumo', coverMediaId: cover } })).json() as { localizations: { slug: string, version: number }[] }
  expect((await owner.post(`/api/admin/articles/${created.id}/publish`, { headers: ORIGIN, data: { locale: 'pt-BR', version: saved.localizations[0]!.version } })).status()).toBe(200)
  for (const path of [`/blog/${saved.localizations[0]!.slug}`, '/blog', `/api/public/blog/${saved.localizations[0]!.slug}?locale=pt-BR`]) {
    expectReached(await anonymous.get(path), mediaPurgeTags(cover))
  }

  // The writes answer as before (the purge is a no-op without Workers Cache)
  const topicX = await tagId(owner, 'x')
  expect((await owner.patch(`/api/admin/tags/${topicX.id}`, { headers: ORIGIN, data: { name: topicX.name } })).status()).toBe(200)
  expect((await owner.patch(`/api/admin/media/${cover}`, { headers: ORIGIN, data: { focalX: 0.4 } })).status()).toBe(200)
})

test('sitemap URLs never carry a query the middleware would redirect', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  const xml = await (await anonymous.get('/sitemap.xml')).text()
  expect(xml).not.toMatch(/<loc>[^<]*\?/)
})
