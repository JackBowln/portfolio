// F03-T3: /api/admin/** authorization over HTTP (ADR-0005 §6). The matrix cases are generated from
// shared/auth/permissions.ts, whose content tests/unit/permissions.test.ts checks against the security model.
// Example routes live in server/api/admin/_test (test build only) until real admin routes exist
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { can, STATEMENTS } from '../../shared/auth/permissions'
import type { Resource } from '../../shared/auth/permissions'
import { ROLES } from '../../shared/types/enums'
import type { Role } from '../../shared/types/enums'

const ORIGIN = { origin: 'http://localhost:8787' }
// routeRules for /api/admin/** (nuxt.config.ts)
const PRIVATE = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' }

async function signIn(request: APIRequestContext, role: Role, ageSeconds = 0): Promise<string> {
  // TEST_AUTH route: exists only in the test build
  const response = await request.post(`/api/_test/session?role=${role}&ageSeconds=${ageSeconds}`, { headers: ORIGIN })
  expect(response.status()).toBe(200)
  return (await response.json()).userId
}

const permissions = (Object.keys(STATEMENTS) as Resource[]).flatMap(resource =>
  STATEMENTS[resource].map(action => ({ resource, action: action as string })))

test.describe('without a session', () => {
  for (const [method, path] of [
    ['GET', '/api/admin/_test/audit'],
    ['POST', '/api/admin/_test/authz'],
    ['GET', '/api/admin/does-not-exist'],
    ['GET', '/api/admin'],
  ] as const) {
    test(`${method} ${path} → 401`, async ({ request }) => {
      const response = await request.fetch(path, { method, headers: ORIGIN, data: method === 'POST' ? { resource: 'article', action: 'read' } : undefined })
      expect(response.status()).toBe(401)
      expect(response.headers()).toMatchObject(PRIVATE)
    })
  }

  test('path variations do not skip the session check', async ({ request }) => {
    for (const path of ['/api//admin/_test/audit', '/api/admin//_test/audit', '/api/admin/_test/audit/', '/api/%61dmin/_test/audit', '/API/admin/_test/audit']) {
      const response = await request.get(path)
      // Never a 200: either the session check answers 401 or the route does not match at all
      expect([401, 404], path).toContain(response.status())
    }
  })

  test('a forged or tampered session cookie → 401', async ({ request }) => {
    await signIn(request, 'owner')
    const state = await request.storageState()
    const token = state.cookies.find(cookie => cookie.name === 'better-auth.session_token')
    expect(token).toBeDefined()
    for (const cookie of [`better-auth.session_token=${token?.value}x`, 'better-auth.session_token=forged.value']) {
      const response = await request.get('/api/admin/_test/audit', { headers: { cookie } })
      expect(response.status(), cookie.slice(0, 40)).toBe(401)
    }
  })
})

test.describe('permission matrix', () => {
  for (const role of ROLES) {
    test(`${role}: every permission matches permissions.ts`, async ({ request }) => {
      await signIn(request, role)
      const expected: Record<string, number> = {}
      const actual: Record<string, number> = {}
      for (const { resource, action } of permissions) {
        const response = await request.post('/api/admin/_test/authz', { headers: ORIGIN, data: { resource, action } })
        expected[`${resource}:${action}`] = can(role, { [resource]: [action] } as never) ? 200 : 403
        actual[`${resource}:${action}`] = response.status()
      }
      expect(actual).toEqual(expected)

      // defineAdminHandler's own check, with a static permission
      const audit = await request.get('/api/admin/_test/audit')
      expect(audit.status()).toBe(can(role, { audit: ['read'] }) ? 200 : 403)
    })
  }

  test('a forbidden response carries the error code and is not cached', async ({ request }) => {
    await signIn(request, 'viewer')
    const response = await request.get('/api/admin/_test/audit')
    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({ data: { code: 'forbidden' } })
    expect(response.headers()).toMatchObject(PRIVATE)
  })

  test('unknown actions are rejected before the permission check', async ({ request }) => {
    await signIn(request, 'owner')
    for (const action of ['constructor', '__proto__', 'write']) {
      const response = await request.post('/api/admin/_test/authz', { headers: ORIGIN, data: { resource: 'article', action } })
      expect(response.status(), action).toBe(400)
    }
  })
})

test.describe('ownership', () => {
  async function attempt(request: APIRequestContext, action: string, authorId: string | null, status: string) {
    const response = await request.post('/api/admin/_test/ownership', { headers: ORIGIN, data: { action, authorId, status } })
    return response.status()
  }

  test('an author changes only their own content and deletes only their own drafts', async ({ request }) => {
    const me = await signIn(request, 'author')
    expect(await attempt(request, 'update', me, 'published')).toBe(200)
    expect(await attempt(request, 'restore', me, 'published')).toBe(200)
    expect(await attempt(request, 'update', 'someone-else', 'draft')).toBe(403)
    expect(await attempt(request, 'update', null, 'draft')).toBe(403)
    expect(await attempt(request, 'delete', me, 'draft')).toBe(200)
    expect(await attempt(request, 'delete', me, 'published')).toBe(403)
    expect(await attempt(request, 'delete', 'someone-else', 'draft')).toBe(403)
  })

  test('an editor is not limited to their own content; a translator cannot change it', async ({ playwright, baseURL }) => {
    const editor = await playwright.request.newContext({ baseURL })
    await signIn(editor, 'editor')
    expect(await attempt(editor, 'delete', 'someone-else', 'published')).toBe(200)

    const translator = await playwright.request.newContext({ baseURL })
    await signIn(translator, 'translator')
    expect(await attempt(translator, 'update', 'someone-else', 'draft')).toBe(403)
    await Promise.all([editor.dispose(), translator.dispose()])
  })
})

test.describe('fresh session', () => {
  test('a sensitive action needs a session younger than 15 min', async ({ playwright, baseURL }) => {
    const fresh = await playwright.request.newContext({ baseURL })
    await signIn(fresh, 'owner')
    expect((await fresh.post('/api/admin/_test/fresh', { headers: ORIGIN })).status()).toBe(200)

    const stale = await playwright.request.newContext({ baseURL })
    await signIn(stale, 'owner', 16 * 60)
    const response = await stale.post('/api/admin/_test/fresh', { headers: ORIGIN })
    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({ data: { code: 'session_not_fresh' } })
    // Still a valid session for actions that do not need a fresh one
    expect((await stale.get('/api/admin/_test/audit')).status()).toBe(200)
    await Promise.all([fresh.dispose(), stale.dispose()])
  })
})

test.describe('Better Auth admin plugin', () => {
  test('its HTTP endpoints are disabled, even for an owner', async ({ request }) => {
    await signIn(request, 'owner')
    for (const [method, path] of [
      ['GET', '/api/auth/admin/list-users'],
      ['POST', '/api/auth/admin/set-role'],
      ['POST', '/api/auth/admin/create-user'],
      ['POST', '/api/auth/admin/impersonate-user'],
      ['POST', '/api/auth/admin/set-user-password'],
    ] as const) {
      const response = await request.fetch(path, { method, headers: ORIGIN, data: method === 'POST' ? {} : undefined })
      expect(response.status(), path).toBe(404)
    }
  })

  test('a user cannot change their own role', async ({ request }) => {
    await signIn(request, 'viewer')
    await request.post('/api/auth/update-user', { headers: ORIGIN, data: { role: 'owner' } })
    const session = await (await request.get('/api/auth/get-session')).json()
    expect(session.user.role).toBe('viewer')
    expect((await request.get('/api/admin/_test/audit')).status()).toBe(403)
  })
})
