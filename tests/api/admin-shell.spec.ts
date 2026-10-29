// F03-T5: own sessions (RF-03.5), the audit log API (RF-02.4) and the admin SPA shell (RF-02.1, RF-02.2).
// Sessions come from the TEST_AUTH route (test build only); ?userId= opens a second session for the same user
import { expect, test } from '@playwright/test'
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test'
import { ROLES } from '../../shared/types/enums'
import type { Role } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'

const ORIGIN = { origin: SITE_ORIGIN }
const HTML = { 'accept': 'text/html', 'sec-fetch-mode': 'navigate' }

interface OwnSession { id: string, current: boolean, userAgent: string | null, createdAt: string, lastUsedAt: string, expiresAt: string }

async function signIn(request: APIRequestContext, role: Role = 'viewer', userId?: string): Promise<string> {
  const query = new URLSearchParams({ role, ...(userId ? { userId } : {}) })
  const response = await request.post(`/api/_test/session?${query}`, { headers: ORIGIN })
  expect(response.status()).toBe(200)
  return (await response.json()).userId
}

async function newContext(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined) {
  return playwright.request.newContext({ baseURL })
}

async function listSessions(request: APIRequestContext): Promise<OwnSession[]> {
  const response = await request.get('/api/admin/sessions')
  expect(response.status()).toBe(200)
  return (await response.json()).sessions
}

test.describe('own sessions', () => {
  test('list only the user\'s sessions, marks the current one and never returns tokens', async ({ playwright, baseURL }) => {
    const first = await newContext(playwright, baseURL)
    const second = await newContext(playwright, baseURL)
    const stranger = await newContext(playwright, baseURL)
    const userId = await signIn(first)
    await signIn(second, 'viewer', userId)
    await signIn(stranger)

    const response = await first.get('/api/admin/sessions')
    const body = await response.text()
    const sessions = JSON.parse(body).sessions as OwnSession[]

    expect(sessions).toHaveLength(2)
    expect(sessions.filter(session => session.current)).toHaveLength(1)
    expect(Object.keys(sessions[0]!).sort()).toEqual(['createdAt', 'current', 'expiresAt', 'id', 'lastUsedAt', 'userAgent'])
    expect(body).not.toMatch(/token/i)
    await Promise.all([first.dispose(), second.dispose(), stranger.dispose()])
  })

  test('a revoked session loses access on its very next request', async ({ playwright, baseURL }) => {
    const keeper = await newContext(playwright, baseURL)
    const revoked = await newContext(playwright, baseURL)
    const userId = await signIn(keeper, 'owner')
    await signIn(revoked, 'owner', userId)
    expect((await revoked.get('/api/admin/sessions')).status()).toBe(200)

    const other = (await listSessions(keeper)).find(session => !session.current)
    const response = await keeper.delete(`/api/admin/sessions/${other!.id}`, { headers: ORIGIN })
    expect(response.status()).toBe(200)

    // No cookie cache: the next call reads D1 and finds no session
    expect((await revoked.get('/api/admin/sessions')).status()).toBe(401)
    expect(await (await revoked.get('/api/auth/get-session')).json()).toBeNull()
    expect(await listSessions(keeper)).toHaveLength(1)
    await Promise.all([keeper.dispose(), revoked.dispose()])
  })

  test('the current session is not revoked here, and other users\' sessions look missing', async ({ playwright, baseURL }) => {
    const user = await newContext(playwright, baseURL)
    const stranger = await newContext(playwright, baseURL)
    await signIn(user)
    await signIn(stranger)
    const [current] = await listSessions(user)
    const [strangers] = await listSessions(stranger)

    expect((await user.delete(`/api/admin/sessions/${current!.id}`, { headers: ORIGIN })).status()).toBe(400)
    expect((await user.delete(`/api/admin/sessions/${strangers!.id}`, { headers: ORIGIN })).status()).toBe(404)
    expect(await listSessions(stranger)).toHaveLength(1)
    await Promise.all([user.dispose(), stranger.dispose()])
  })

  test('Better Auth\'s own session endpoints, which return tokens, are off', async ({ playwright, baseURL }) => {
    const user = await newContext(playwright, baseURL)
    await signIn(user)
    expect((await user.get('/api/auth/list-sessions')).status()).toBe(404)
    for (const path of ['/api/auth/revoke-session', '/api/auth/revoke-sessions', '/api/auth/revoke-other-sessions']) {
      const response = await user.post(path, { headers: ORIGIN, data: { token: 'x' } })
      expect(response.status(), path).toBe(404)
    }
    await user.dispose()
  })
})

test.describe('audit log API', () => {
  test('needs audit:read', async ({ playwright, baseURL }) => {
    const anonymous = await newContext(playwright, baseURL)
    expect((await anonymous.get('/api/admin/audit')).status()).toBe(401)
    for (const role of ROLES) {
      const context = await newContext(playwright, baseURL)
      await signIn(context, role)
      const allowed = role === 'owner' || role === 'admin'
      expect((await context.get('/api/admin/audit')).status(), role).toBe(allowed ? 200 : 403)
      await context.dispose()
    }
    await anonymous.dispose()
  })

  test('filters by action and actor, pages with a cursor and never returns the IP hash', async ({ playwright, baseURL }) => {
    const owner = await newContext(playwright, baseURL)
    const userId = await signIn(owner, 'owner')
    // Two revocations by this owner: two audit entries to page through
    for (let index = 0; index < 2; index++) {
      const extra = await newContext(playwright, baseURL)
      await signIn(extra, 'owner', userId)
      const other = (await listSessions(owner)).find(session => !session.current)
      expect((await owner.delete(`/api/admin/sessions/${other!.id}`, { headers: ORIGIN })).status()).toBe(200)
      await extra.dispose()
    }

    const query = { action: 'auth.session_revoked', actor: userId, limit: '1' }
    const first = await owner.get('/api/admin/audit', { params: query })
    const firstBody = await first.text()
    const page = JSON.parse(firstBody)
    expect(page.entries).toHaveLength(1)
    expect(page.entries[0]).toMatchObject({ action: 'auth.session_revoked', actor: { id: userId, name: 'TEST_AUTH user' }, entityType: 'session' })
    expect(page.nextCursor).toBe(page.entries[0].id)
    expect(page.actors).toEqual(expect.arrayContaining([{ id: userId, name: 'TEST_AUTH user' }]))
    expect(firstBody).not.toMatch(/ipHash|ip_hash/)

    const second = await (await owner.get('/api/admin/audit', { params: { ...query, cursor: page.nextCursor } })).json()
    expect(second.entries).toHaveLength(1)
    expect(second.entries[0].id < page.entries[0].id).toBe(true)
    const third = await (await owner.get('/api/admin/audit', { params: { ...query, cursor: second.entries[0].id } })).json()
    expect(third).toMatchObject({ entries: [], nextCursor: null })

    const today = new Date().toISOString().slice(0, 10)
    const inPeriod = await (await owner.get('/api/admin/audit', { params: { ...query, limit: '10', from: today, to: today } })).json()
    expect(inPeriod.entries).toHaveLength(2)
    const before = await (await owner.get('/api/admin/audit', { params: { ...query, to: '2020-01-01' } })).json()
    expect(before.entries).toEqual([])
    await owner.dispose()
  })

  test('rejects unknown filters and malformed values', async ({ playwright, baseURL }) => {
    const owner = await newContext(playwright, baseURL)
    await signIn(owner, 'owner')
    for (const params of [{ ipHash: 'x' }, { from: '28/10/2026' }, { action: 'auth.unknown' }, { limit: '101' }]) {
      expect((await owner.get('/api/admin/audit', { params })).status(), JSON.stringify(params)).toBe(400)
    }
    await owner.dispose()
  })
})

test.describe('admin SPA shell', () => {
  test('/admin pages are a private, unindexed shell with no data in the HTML', async ({ playwright, baseURL }) => {
    const owner = await newContext(playwright, baseURL)
    await signIn(owner, 'owner')
    for (const path of ['/admin', '/admin/auditoria', '/admin/conta/sessoes']) {
      const response = await owner.get(path, { headers: HTML })
      const headers = response.headers()
      const html = await response.text()

      expect(response.status(), path).toBe(200)
      expect(headers['cache-control'], path).toBe('private, no-store')
      expect(headers['x-robots-tag'], path).toBe('noindex, nofollow')
      expect(headers['set-cookie'], path).toBeUndefined()
      // Rendered in the browser only: an empty app root, and nothing about the signed-in user
      expect(html, path).toMatch(/<div id="__nuxt"><\/div>/)
      expect(html, path).not.toContain('TEST_AUTH user')
    }
    await owner.dispose()
  })
})
