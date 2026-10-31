// F08-T3: the contact form over HTTP (security-model §2). Cross-origin → 403, not JSON → 415, fields → 422 with the
// issues, no Turnstile → 400, RL_PUBLIC → 429 with Retry-After; a valid message (Turnstile's always-pass test key)
// is stored without echoing anything or setting a cookie. Turnstile's origin is in the CSP of the contact page only.
// The inbox is owner and admin only, never returns the IP hash, and audits without the content. The form switch is
// not turned off here: other specs use the form in parallel
import { expect, test } from '@playwright/test'
import type { PlaywrightWorkerArgs } from '@playwright/test'
import type { Role } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'

const ORIGIN = { origin: SITE_ORIGIN }
const testIp = () => `2001:db8::${crypto.randomUUID().slice(0, 4)}:${crypto.randomUUID().slice(0, 4)}`
const headers = (ip = testIp()) => ({ ...ORIGIN, 'cf-connecting-ip': ip })
const valid = { name: 'Visitante API', email: 'visitor@example.test', message: 'Uma mensagem de teste da API.', locale: 'pt-BR', turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' }

async function session(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, role: Role) {
  const request = await playwright.request.newContext({ baseURL })
  const response = await request.post(`/api/_test/session?role=${role}`, { headers: ORIGIN })
  expect(response.status()).toBe(200)
  return request
}

test('refuses cross-origin (403) and non-JSON (415) submissions', async ({ request }) => {
  expect((await request.post('/api/public/contact', { headers: { 'origin': 'https://evil.example', 'cf-connecting-ip': testIp() }, data: valid })).status()).toBe(403)
  expect((await request.post('/api/public/contact', { headers: headers(), form: { name: 'x' } })).status()).toBe(415)
})

test('answers invalid fields with 422 and the issues, and a missing Turnstile with 400', async ({ request }) => {
  const invalid = await request.post('/api/public/contact', { headers: headers(), data: { ...valid, email: 'not-an-email', message: 'curta' } })
  expect(invalid.status()).toBe(422)
  const body = await invalid.json() as { data: { issues: { path: string, message: string }[] } }
  expect(body.data.issues).toEqual([{ path: 'email', message: 'invalid_email' }, { path: 'message', message: 'too_short' }])
  expect(await invalid.text()).not.toContain('not-an-email')

  const unknownKey = await request.post('/api/public/contact', { headers: headers(), data: { ...valid, '<script>x': true } })
  expect(unknownKey.status()).toBe(422)
  // Never reflected, not even the name of an unknown key
  expect(await unknownKey.text()).not.toContain('script')
  const { turnstileToken: _, ...withoutToken } = valid
  expect((await request.post('/api/public/contact', { headers: headers(), data: withoutToken })).status()).toBe(400)
})

test('allows 3 submissions per minute per IP, then 429 with Retry-After', async ({ request }) => {
  const ip = testIp()
  // Invalid bodies: the limit is checked before the fields, so nothing is stored
  for (let attempt = 1; attempt <= 3; attempt++) {
    expect((await request.post('/api/public/contact', { headers: headers(ip), data: {} })).status(), `attempt ${attempt}`).toBe(422)
  }
  const limited = await request.post('/api/public/contact', { headers: headers(ip), data: valid })
  expect(limited.status()).toBe(429)
  expect(limited.headers()['retry-after']).toBe('60')
  expect((await request.post('/api/public/contact', { headers: headers(), data: {} })).status()).toBe(422)
})

test('stores a valid message without echoing it or setting a cookie; the inbox reads it (owner and admin only)', async ({ request, playwright, baseURL }) => {
  const name = `Visitante ${crypto.randomUUID().slice(0, 8)}`
  const sent = await request.post('/api/public/contact', { headers: headers(), data: { ...valid, name } })
  expect(sent.status(), await sent.text()).toBe(200)
  expect(await sent.json()).toEqual({ ok: true })
  expect(sent.headers()['set-cookie']).toBeUndefined()
  expect(sent.headers()['cache-control']).toBe('no-store')

  for (const role of ['editor', 'author', 'translator', 'viewer'] as const) {
    expect((await (await session(playwright, baseURL, role)).get('/api/admin/contact')).status(), role).toBe(403)
  }
  const admin = await session(playwright, baseURL, 'admin')
  const { items } = await (await admin.get('/api/admin/contact?status=new&limit=50')).json() as { items: { id: string, name: string }[] }
  const item = items.find(entry => entry.name === name)
  expect(item).toBeDefined()
  expect(JSON.stringify(items)).not.toMatch(/ip_?hash/i)

  expect((await (await admin.get(`/api/admin/contact/${item!.id}`)).json()).status).toBe('read')
  expect((await admin.patch(`/api/admin/contact/${item!.id}`, { headers: ORIGIN, data: { status: 'new' } })).status()).toBe(400)
  const archived = await admin.patch(`/api/admin/contact/${item!.id}`, { headers: ORIGIN, data: { status: 'archived' } })
  expect((await archived.json()).status).toBe('archived')
  expect((await admin.delete(`/api/admin/contact/${item!.id}`, { headers: ORIGIN })).status()).toBe(200)
  expect((await admin.get(`/api/admin/contact/${item!.id}`)).status()).toBe(404)

  const owner = await session(playwright, baseURL, 'owner')
  const audit = await (await owner.get('/api/admin/audit?action=contact.deleted')).json() as { entries: { entityId: string, metadata: unknown }[] }
  const entry = audit.entries.find(row => row.entityId === item!.id)
  expect(entry).toBeDefined()
  expect(JSON.stringify(entry)).not.toContain(name)
})

test('loads Turnstile on the contact page only (CSP)', async ({ request }) => {
  for (const path of ['/contato', '/en/contact', '/es/contacto', '/de/kontakt', '/fr/contact']) {
    const csp = (await request.get(path)).headers()['content-security-policy'] ?? ''
    expect(csp, path).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/)
    expect(csp, path).toMatch(/frame-src [^;]*https:\/\/challenges\.cloudflare\.com/)
  }
  for (const path of ['/', '/sobre', '/blog', '/privacidade']) {
    expect((await request.get(path)).headers()['content-security-policy'], path).not.toContain('challenges.cloudflare.com')
  }
})
