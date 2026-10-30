// F08-T1: settings over HTTP. Only owner and admin save (settings:update); ai_translation also needs a fresh session;
// input is strict per key; a stale version is a 409; every save is audited without values; the public endpoint never
// carries ai_translation; public pages carry the `settings` tag so a save purges them. Only keys without a visible
// effect are changed here (the hidden contact e-mail, the AI limits), since other specs read the site in parallel
import { expect, test } from '@playwright/test'
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test'
import type { Role } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'

const ORIGIN = { origin: SITE_ORIGIN }

async function session(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, role: Role, ageSeconds = 0) {
  const request = await playwright.request.newContext({ baseURL })
  const response = await request.post(`/api/_test/session?role=${role}&ageSeconds=${ageSeconds}`, { headers: ORIGIN })
  expect(response.status()).toBe(200)
  return Object.assign(request, { userId: (await response.json()).userId as string })
}

async function current(request: APIRequestContext, key: string) {
  const { items } = await (await request.get('/api/admin/settings')).json() as { items: { key: string, version: number, value: Record<string, unknown> }[] }
  return items.find(item => item.key === key)!
}

const put = (request: APIRequestContext, key: string, data: unknown) => request.put(`/api/admin/settings/${key}`, { headers: ORIGIN, data })

test('only owner and admin save; editors read; viewers read too', async ({ playwright, baseURL }) => {
  const editor = await session(playwright, baseURL, 'editor')
  const contact = await current(editor, 'contact')
  expect((await put(editor, 'contact', { version: contact.version, value: { email: null, showEmail: false } })).status()).toBe(403)
  const viewer = await session(playwright, baseURL, 'viewer')
  expect((await viewer.get('/api/admin/settings')).status()).toBe(200)
  const author = await session(playwright, baseURL, 'author')
  expect((await author.get('/api/admin/settings')).status()).toBe(403)

  const admin = await session(playwright, baseURL, 'admin')
  const saved = await put(admin, 'contact', { version: contact.version, value: { email: 'contato@example.com', showEmail: false } })
  expect(saved.status(), await saved.text()).toBe(200)
  expect((await saved.json()).version).toBe(contact.version + 1)
  // The same version again is stale
  expect((await put(admin, 'contact', { version: contact.version, value: { email: null, showEmail: false } })).status()).toBe(409)
  const owner = await session(playwright, baseURL, 'owner')
  const audit = (await (await owner.get(`/api/admin/audit?limit=20&action=settings.updated&actor=${admin.userId}`)).json()).entries as { entityId: string, metadata: Record<string, unknown> }[]
  expect(audit[0]).toMatchObject({ entityId: 'contact', metadata: { version: contact.version + 1 } })
  expect(JSON.stringify(audit)).not.toContain('contato@example.com')
})

test('ai_translation needs a fresh session and keeps its limits', async ({ playwright, baseURL }) => {
  const stale = await session(playwright, baseURL, 'owner', 20 * 60)
  const ai = await current(stale, 'ai_translation')
  const notFresh = await put(stale, 'ai_translation', { version: ai.version, value: ai.value })
  expect(notFresh.status()).toBe(403)
  expect((await notFresh.json()).data.code).toBe('session_not_fresh')
  // Other keys do not need it
  const contact = await current(stale, 'contact')
  expect((await put(stale, 'contact', { version: contact.version, value: contact.value })).status()).toBe(200)

  const fresh = await session(playwright, baseURL, 'owner')
  for (const value of [{ ...ai.value, provider: 'anthropic' }, { ...ai.value, dailyNeuronCap: 20_000 }, { ...ai.value, extra: true }]) {
    expect((await put(fresh, 'ai_translation', { version: ai.version, value })).status(), JSON.stringify(value)).toBe(400)
  }
  expect((await put(fresh, 'ai_translation', { version: ai.version, value: ai.value })).status()).toBe(200)
})

test('input is strict per key', async ({ playwright, baseURL }) => {
  const owner = await session(playwright, baseURL, 'owner')
  const social = await current(owner, 'social')
  for (const data of [
    { version: social.version, value: { links: [{ network: 'github', url: 'http://github.com/x' }] } },
    { version: social.version, value: { links: [] }, localizations: { en: {} } },
    { version: social.version, value: { links: [] }, extra: 1 },
  ]) {
    expect((await put(owner, 'social', data)).status(), JSON.stringify(data)).toBe(400)
  }
  expect((await put(owner, 'unknown', { version: 0, value: {} })).status()).toBe(400)
  const footer = await current(owner, 'footer')
  expect((await put(owner, 'footer', { version: footer.version, value: footer.value, localizations: { 'pt-BR': null } })).status()).toBe(400)
})

test('the public settings are cached, tagged and never carry ai_translation; pages carry the settings tag', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL })
  const response = await anonymous.get('/api/public/settings?locale=de')
  expect(response.status()).toBe(200)
  expect(response.headers()).toMatchObject({ 'cache-control': 'public, max-age=0, s-maxage=604800' })
  expect(response.headers()['cache-tag']?.split(',')).toContain('settings')
  expect(response.headers()['set-cookie']).toBeUndefined()
  const body = await response.text()
  expect(body).not.toContain('dailyNeuronCap')
  expect(body).not.toContain('contato@example.com')
  for (const path of ['/', '/sobre', '/blog', '/de/projekte']) {
    const page = await anonymous.get(path)
    expect(page.headers()['cache-tag']?.split(','), path).toContain('settings')
    expect(page.headers()['set-cookie'], path).toBeUndefined()
  }
  expect((await anonymous.get('/api/public/settings?locale=it')).status()).toBe(400)
})
