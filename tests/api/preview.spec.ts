// F06-T3: preview links over HTTP. Generating one needs article:update (an author only on their own articles) and is
// audited; the link's page and data are private, no-store, noindex, without Cache-Tag or Set-Cookie; and an expired,
// tampered, foreign or stale token is the same 404, with the same body. Tokens for the bad cases are signed here
// with the test build's secret (package.json preview:test)
import { createHmac, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test'
import type { Role } from '../../shared/types/enums'
import { PREVIEW_TOKEN_SECRET, SITE_ORIGIN } from '../support/auth'

const ORIGIN = { origin: SITE_ORIGIN }
const b64 = (value: Buffer | string) => Buffer.from(value).toString('base64url')

/** A token as the server makes it, with any claims */
function sign(claims: Record<string, unknown>, secret = PREVIEW_TOKEN_SECRET): string {
  const payload = b64(JSON.stringify(claims))
  return `${payload}.${b64(createHmac('sha256', secret).update(payload).digest())}`
}

async function session(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, role: Role) {
  const request = await playwright.request.newContext({ baseURL })
  expect((await request.post(`/api/_test/session?role=${role}`, { headers: ORIGIN })).status()).toBe(200)
  return request
}

async function article(request: APIRequestContext) {
  const response = await request.post('/api/admin/articles', { headers: ORIGIN, data: { title: `Prévia ${randomBytes(4).toString('hex')}` } })
  expect(response.status()).toBe(201)
  const created = await response.json() as { id: string }
  expect((await request.patch(`/api/admin/articles/${created.id}`, { headers: ORIGIN, data: { version: 1, excerpt: 'Resumo do rascunho' } })).status()).toBe(200)
  return created.id
}

const link = (request: APIRequestContext, id: string, data: unknown = { hours: 1 }) => request.post(`/api/admin/articles/${id}/preview-link`, { headers: ORIGIN, data })

test('a preview link shows the working copy, privately and unindexed', async ({ playwright, baseURL }) => {
  const owner = await session(playwright, baseURL, 'owner')
  const id = await article(owner)
  const created = await link(owner, id, { hours: 8 })
  expect(created.status()).toBe(200)
  const { url, expiresAt } = await created.json() as { url: string, expiresAt: string }
  expect(url).toMatch(/^http:\/\/localhost:8787\/preview\/[\w-]+\.[\w-]+$/)
  const hours = (Date.parse(expiresAt) - Date.now()) / 3_600_000
  expect(hours).toBeGreaterThan(7.9)
  expect(hours).toBeLessThanOrEqual(8)
  const token = url.split('/').at(-1)!

  // Anyone with the link, signed in or not
  const anonymous = await playwright.request.newContext({ baseURL })
  for (const path of [`/api/preview/${token}`, `/preview/${token}`]) {
    const response = await anonymous.get(path)
    expect(response.status(), path).toBe(200)
    const headers = response.headers()
    expect(headers['cache-control'], path).toBe('private, no-store')
    expect(headers['x-robots-tag'], path).toBe('noindex, nofollow')
    expect(headers['cache-tag'], path).toBeUndefined()
    expect(headers['set-cookie'], path).toBeUndefined()
  }
  expect(await (await anonymous.get(`/api/preview/${token}`)).json()).toMatchObject({ locale: 'pt-BR', excerpt: 'Resumo do rascunho' })
  const html = await (await anonymous.get(`/preview/${token}`)).text()
  expect(html).toContain('Pré-visualização')
  expect(html).toContain('Resumo do rascunho')
  expect(html).toMatch(/<meta name="robots" content="noindex, nofollow">/)

  const audit = await (await owner.get('/api/admin/audit?action=article.preview_link_created&limit=100')).json() as { entries: { entityId: string, metadata: { hours: number } }[] }
  expect(audit.entries.find(entry => entry.entityId === id)?.metadata).toEqual({ hours: 8 })
})

test('expired, tampered, foreign and stale tokens are the same plain 404', async ({ playwright, baseURL }) => {
  const owner = await session(playwright, baseURL, 'owner')
  const id = await article(owner)
  const deleted = await article(owner)
  expect((await owner.delete(`/api/admin/articles/${deleted}`, { headers: ORIGIN })).status()).toBe(200)
  const now = Math.floor(Date.now() / 1000)
  const valid = sign({ t: 'article', id, l: 'pt-BR', exp: now + 600 })
  const [payload, signature] = valid.split('.') as [string, string]
  const anonymous = await playwright.request.newContext({ baseURL })
  expect((await anonymous.get(`/api/preview/${valid}`)).status()).toBe(200)

  const bodies = new Set<string>()
  for (const [name, token] of [
    ['expired', sign({ t: 'article', id, l: 'pt-BR', exp: now - 1 })],
    ['beyond 24 h', sign({ t: 'article', id, l: 'pt-BR', exp: now + 25 * 3600 })],
    ['another secret', sign({ t: 'article', id, l: 'pt-BR', exp: now + 600 }, 'x'.repeat(40))],
    ['forged payload', `${b64(JSON.stringify({ t: 'article', id: deleted, l: 'pt-BR', exp: now + 600 }))}.${signature}`],
    ['cut signature', `${payload}.${signature.slice(0, -2)}`],
    ['deleted article', sign({ t: 'article', id: deleted, l: 'pt-BR', exp: now + 600 })],
    ['missing article', sign({ t: 'article', id: '01a18000-0000-7000-8000-000000000999', l: 'pt-BR', exp: now + 600 })],
    ['missing localization', sign({ t: 'article', id, l: 'de', exp: now + 600 })],
    ['unknown kind', sign({ t: 'page', id, l: 'pt-BR', exp: now + 600 })],
    ['garbage', 'not-a-token'],
    ['too long', 'a'.repeat(600)],
  ] as const) {
    const response = await anonymous.get(`/api/preview/${token}`)
    expect(response.status(), name).toBe(404)
    // Nitro forces no-cache on JSON 404s (server-infra.spec.ts); never public, never tagged
    expect(response.headers()['cache-control'], name).toMatch(/^(private, no-store|no-cache)$/)
    expect(response.headers()['cache-tag'], name).toBeUndefined()
    // The url is the request echoed back; everything else must be identical
    const body = await response.json() as Record<string, unknown>
    bodies.add(JSON.stringify({ ...body, url: undefined, stack: undefined }))
    expect((await anonymous.get(`/preview/${token}`)).status(), `${name} (page)`).toBe(404)
  }
  // Nothing tells the cases apart
  expect(bodies.size).toBe(1)
})

test('generating a link needs article:update; an author only on their own articles', async ({ playwright, baseURL }) => {
  const owner = await session(playwright, baseURL, 'owner')
  const others = await article(owner)
  const author = await session(playwright, baseURL, 'author')
  const own = await article(author)
  expect((await link(author, own)).status()).toBe(200)
  expect((await link(author, others)).status()).toBe(403)
  for (const role of ['translator', 'viewer'] as const) {
    expect((await link(await session(playwright, baseURL, role), others)).status(), role).toBe(403)
  }
  for (const [name, data] of [['zero hours', { hours: 0 }], ['too long', { hours: 25 }], ['fraction', { hours: 1.5 }], ['extra field', { hours: 1, locale: 'en' }], ['empty', {}]] as const) {
    expect((await link(owner, others, data)).status(), name).toBe(400)
  }
  expect((await owner.post(`/api/admin/articles/${others}/preview-link`, { headers: { origin: 'https://evil.example' }, data: { hours: 1 } })).status()).toBe(403)
})
