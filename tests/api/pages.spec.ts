// F08-T2: institutional pages over HTTP. Editors save and publish, authors and below do not; the input is strict per
// page. Publicly, a page published only in pt-BR is indexable there and, in another locale, shown from pt-BR with
// noindex, no hreflang for that locale and out of the sitemap; a page with nothing published is an empty state
// (noindex). Pages are cached and tagged, with no cookie. Nothing is published here (other specs read these pages)
import { expect, test } from '@playwright/test'
import type { PlaywrightWorkerArgs } from '@playwright/test'
import type { Role } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'
import { ensureBlogFixture } from '../support/blog'

const ORIGIN = { origin: SITE_ORIGIN }

async function session(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, role: Role) {
  const request = await playwright.request.newContext({ baseURL })
  expect((await request.post(`/api/_test/session?role=${role}`, { headers: ORIGIN })).status()).toBe(200)
  return request
}

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('editors edit pages; authors, translators and viewers do not; the input is strict', async ({ playwright, baseURL }) => {
  const editor = await session(playwright, baseURL, 'editor')
  const page = await (await editor.get('/api/admin/pages/contact')).json() as { localizations: { locale: string, version: number }[] }
  const version = page.localizations.find(item => item.locale === 'pt-BR')!.version
  for (const data of [
    { version, blocks: { intro: 'x', success: 'y', extra: 1 } },
    { version, blocks: { intro: 'x'.repeat(601), success: '' } },
    { version, unknown: true },
  ]) {
    expect((await editor.patch('/api/admin/pages/contact', { headers: ORIGIN, data })).status(), JSON.stringify(data)).toBe(400)
  }
  expect((await editor.patch('/api/admin/pages/nope', { headers: ORIGIN, data: { version, noindex: false } })).status()).toBe(400)
  expect((await editor.patch('/api/admin/pages/contact', { headers: ORIGIN, data: { version: version + 99, noindex: false } })).status()).toBe(409)

  for (const role of ['author', 'translator', 'viewer'] as const) {
    const request = await session(playwright, baseURL, role)
    expect((await request.patch('/api/admin/pages/contact', { headers: ORIGIN, data: { version, noindex: false } })).status(), role).toBe(403)
    expect((await request.post('/api/admin/pages/contact/publish', { headers: ORIGIN, data: { locale: 'pt-BR', version } })).status(), role).toBe(403)
  }
  expect((await (await session(playwright, baseURL, 'viewer')).get('/api/admin/pages')).status()).toBe(200)
})

test('a page published in pt-BR only: indexable there, a noindex fallback elsewhere, out of that locale in the sitemap', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  const original = await anonymous.get('/sobre')
  expect(original.headers()['cache-tag']?.split(',')).toContain('page:about:pt-BR')
  const originalHtml = await original.text()
  expect(originalHtml).not.toContain('<meta name="robots"')
  // In the head (the language switcher's links carry hreflang too)
  expect(originalHtml).toMatch(/<link[^>]+rel="alternate"[^>]+hreflang="pt-BR"/)
  expect(originalHtml).not.toMatch(/<link[^>]+rel="alternate"[^>]+hreflang="de"/)

  const fallback = await anonymous.get('/de/ueber-mich')
  expect(fallback.status()).toBe(200)
  expect(fallback.headers()['cache-tag']?.split(',')).toContain('page:about:de')
  expect(fallback.headers()['set-cookie']).toBeUndefined()
  const html = await fallback.text()
  expect(html).toContain('<meta name="robots" content="noindex">')
  expect(html).not.toMatch(/<link[^>]+rel="alternate"[^>]+hreflang=/)
  expect(html).toContain('data-testid="fallback-notice"')
  expect(html).toContain('lang="pt-BR"')

  const data = await (await anonymous.get('/api/public/pages/about?locale=de')).json() as { fallback: boolean, published: string[] }
  expect(data).toMatchObject({ fallback: true, published: ['pt-BR'] })
  const sitemap = await (await anonymous.get('/sitemap.xml')).text()
  expect(sitemap).toMatch(/\/sobre<\/loc>/)
  expect(sitemap).not.toContain('/de/ueber-mich')
})

test('a page with nothing published has noindex (contact keeps its form, F08-T3); privacy always lists the data it handles', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  const contact = await (await anonymous.get('/contato')).text()
  expect(contact).not.toContain('data-testid="page-empty"')
  expect(contact).toContain('aria-label="Formulário de contato"')
  expect(contact).toContain('<meta name="robots" content="noindex">')
  const privacy = await (await anonymous.get('/en/privacy')).text()
  expect(privacy).toContain('Contact form messages (name, e-mail and message), kept for 12 months.')
  expect(privacy).toContain('Technical logs of the hosting platform (Cloudflare), kept for 3 days.')
  expect((await anonymous.get('/api/public/pages/unknown?locale=pt-BR')).status()).toBe(400)
})
