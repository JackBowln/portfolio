// F03-T1: Better Auth mounted with no public sign-up; session cookie flags (ADR-0005 §4)
import { expect, test } from '@playwright/test'

const ORIGIN = { origin: 'http://localhost:8787' }
const credentials = { email: 'someone@example.com', password: 'a-long-password-123', name: 'Someone' }

test('there is no email and password sign-up or sign-in', async ({ request }) => {
  const signUp = await request.post('/api/auth/sign-up/email', { headers: ORIGIN, data: credentials })
  expect(signUp.status()).toBe(400)
  expect(await signUp.json()).toMatchObject({ code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED' })
  expect(signUp.headers()['set-cookie']).toBeUndefined()

  const signIn = await request.post('/api/auth/sign-in/email', { headers: ORIGIN, data: credentials })
  expect(signIn.status()).toBe(400)
  expect(await signIn.json()).toMatchObject({ code: 'EMAIL_PASSWORD_DISABLED' })
})

test('without a session, get-session is null, uncached and sets no cookie', async ({ request }) => {
  const response = await request.get('/api/auth/get-session')

  expect(response.status()).toBe(200)
  expect(await response.json()).toBeNull()
  expect(response.headers()['cache-control']).toBe('no-store')
  expect(response.headers()['set-cookie']).toBeUndefined()
})

test('the session cookie is HttpOnly, SameSite=Lax, 7 days, with no cached session copy', async ({ request }) => {
  // TEST_AUTH route: exists only in the test build
  const response = await request.post('/api/_test/session', { headers: ORIGIN })
  expect(response.status()).toBe(200)

  const cookies = response.headersArray().filter(header => header.name.toLowerCase() === 'set-cookie').map(header => header.value)
  const sessionToken = cookies.find(cookie => cookie.startsWith('better-auth.session_token='))

  expect(sessionToken).toContain('HttpOnly')
  expect(sessionToken).toContain('SameSite=Lax')
  expect(sessionToken).toContain('Path=/')
  // http://localhost: no Secure flag or __Secure- prefix (covered for https in tests/unit/auth-options.test.ts)
  expect(sessionToken).not.toContain('Secure')
  expect(sessionToken).toContain('Max-Age=604800')
  // The cookie cache is off (F03-T5): every check reads D1, so a revoked session stops at once
  expect(cookies.some(cookie => cookie.startsWith('better-auth.session_data='))).toBe(false)

  const session = await (await request.get('/api/auth/get-session')).json()
  expect(session.user).toMatchObject({ name: 'TEST_AUTH user', emailVerified: true, role: 'viewer' })
  expect(session.session.ipAddress).toBeNull()
})
