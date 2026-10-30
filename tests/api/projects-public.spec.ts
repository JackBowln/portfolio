// F07-T2: the public projects over HTTP. Pages and data endpoints are cacheable at the edge with their tags and no
// cookie; the technology filter (unknown → 404); a project only in pt-BR is absent elsewhere; the working copy never
// reaches the site; the sitemap lists published projects with their alternates
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIResponse, PlaywrightWorkerArgs } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { ensureBlogFixture } from '../support/blog'

const ORIGIN = { origin: SITE_ORIGIN }
const unique = () => randomBytes(4).toString('hex')

async function editor(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined) {
  const request = await playwright.request.newContext({ baseURL })
  expect((await request.post('/api/_test/session?role=editor', { headers: ORIGIN })).status()).toBe(200)
  return request
}

function expectPublic(response: APIResponse, tag: string) {
  expect(response.status(), response.url()).toBe(200)
  expect(response.headers()['cache-control'], response.url()).toBe('public, max-age=0, s-maxage=604800')
  expect(response.headers()['cache-tag']?.split(','), response.url()).toContain(tag)
  expect(response.headers()['set-cookie'], response.url()).toBeUndefined()
}

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('pages and data endpoints are cached at the edge, tagged, and set no cookie', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  for (const [path, tag] of [
    ['/projetos', 'list:projects:pt-BR'],
    ['/de/projekte', 'list:projects:de'],
    ['/projetos?tech=tecnologia-x', 'list:projects:pt-BR'],
    ['/projetos/x', 'list:projects:pt-BR'],
    ['/fr/projets/x', 'list:projects:fr'],
    ['/api/public/projects?locale=en', 'list:projects:en'],
    ['/api/public/projects?locale=pt-BR&tech=tecnologia-x', 'list:projects:pt-BR'],
    ['/api/public/projects/x?locale=es', 'list:projects:es'],
  ] as const) {
    expectPublic(await anonymous.get(path), tag)
  }
  // The project's own tags reach its HTML, so a publish purges exactly its pages
  const project = await (await anonymous.get('/api/public/projects/x?locale=pt-BR')).json() as { cacheTags: string[] }
  const html = await anonymous.get('/projetos/x')
  for (const tag of project.cacheTags) {
    expect(html.headers()['cache-tag']?.split(',')).toContain(tag)
  }
  // A filtered list is noindex, with the whole list as its canonical
  const filtered = await (await anonymous.get('/projetos?tech=tecnologia-x')).text()
  expect(filtered).toContain('<meta name="robots" content="noindex">')
  expect(filtered).toMatch(/<link rel="canonical" href="https?:\/\/[^"]+\/projetos">/)
})

test('the public reads the published snapshot; a project only in pt-BR is absent elsewhere', async ({ playwright, baseURL }) => {
  const request = await editor(playwright, baseURL)
  const title = `Projeto público ${unique()}`
  const created = await (await request.post('/api/admin/projects', { headers: ORIGIN, data: { title } })).json() as { id: string, localizations: { slug: string }[] }
  const slug = created.localizations[0]!.slug
  expect((await request.patch(`/api/admin/projects/${created.id}`, { headers: ORIGIN, data: { version: 1, summary: 'No site', demoUrl: 'https://example.com/demo' } })).status()).toBe(200)
  expect((await request.post(`/api/admin/projects/${created.id}/publish`, { headers: ORIGIN, data: { locale: 'pt-BR', version: 2 } })).status()).toBe(200)
  expect((await request.patch(`/api/admin/projects/${created.id}`, { headers: ORIGIN, data: { version: 2, title: 'Rascunho secreto' } })).status()).toBe(200)

  const anonymous = await playwright.request.newContext({ baseURL })
  const page = await (await anonymous.get(`/projetos/${slug}`)).text()
  expect(page).toContain(title)
  expect(page).not.toContain('Rascunho secreto')
  expect(page).toContain('href="https://example.com/demo" rel="noopener noreferrer"')
  for (const path of [`/en/projects/${slug}`, `/api/public/projects/${slug}?locale=en`]) {
    const response = await anonymous.get(path)
    expect(response.status(), path).toBe(404)
    expect(response.headers()['set-cookie']).toBeUndefined()
  }
  const english = await (await anonymous.get('/api/public/projects?locale=en')).json() as { items: { slug: string }[] }
  expect(english.items.some(item => item.slug === slug)).toBe(false)
  const sitemap = await (await anonymous.get('/sitemap.xml')).text()
  const entry = sitemap.split('<url>').find(block => block.includes(`/projetos/${slug}</loc>`))
  expect(entry).toBeDefined()
  expect(entry).not.toContain('hreflang="en"')
  expect(sitemap).toContain('/de/projekte/x</loc>')

  expect((await request.post(`/api/admin/projects/${created.id}/unpublish`, { headers: ORIGIN, data: { locale: 'pt-BR' } })).status()).toBe(200)
  expect((await anonymous.get(`/projetos/${slug}`)).status()).toBe(404)
  expect(await (await anonymous.get('/sitemap.xml')).text()).not.toContain(`/projetos/${slug}</loc>`)
})

test('unknown technologies, slugs and bad input answer 404 or 400 without a cookie', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  for (const [path, status] of [
    ['/projetos?tech=nao-existe', 404],
    ['/projetos?tech=Bad Slug', 404],
    ['/projetos/nao-existe-mesmo', 404],
    ['/api/public/projects?locale=pt-BR&tech=nao-existe', 404],
    ['/api/public/projects/nao-existe-mesmo?locale=pt-BR', 404],
    ['/api/public/projects?locale=it', 400],
    ['/api/public/projects?locale=pt-BR&extra=1', 400],
  ] as const) {
    const response = await anonymous.get(path)
    expect(response.status(), path).toBe(status)
    expect(response.headers()['set-cookie'], path).toBeUndefined()
  }
})
