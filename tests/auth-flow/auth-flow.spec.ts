// F03-T2: owner bootstrap, GitHub allowlist, passkeys and the audit trail (ADR-0005 §2–§4, §8).
// Serial and alone (project auth-flow): it empties the auth tables, so "no owner yet" holds at the start.
// GitHub is simulated inside the test Worker (server/_test/github-mock.ts): `code=gh-<id>` signs in as that GitHub id.
// Passkeys use Chromium's virtual WebAuthn authenticator
import { createHmac } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { BOOTSTRAP_TOKEN, IP_HASH_SALT, OWNER_GITHUB_ID, SITE_ORIGIN } from '../support/auth'

test.describe.configure({ mode: 'serial' })

const ORIGIN = { origin: SITE_ORIGIN }
const DENIED_GITHUB_ID = '999'

interface AuthState {
  users: number
  owners: number
  passkeys: number
  audit: { action: string, metadata: string | null, ipHash: string | null }[]
}

async function authState(request: APIRequestContext): Promise<AuthState> {
  return (await request.get('/api/_test/auth-state')).json()
}

const actions = (state: AuthState) => state.audit.map(entry => entry.action)

/** Runs the GitHub OAuth round trip in a request context: sign-in, then the callback GitHub would call */
async function githubCallback(request: APIRequestContext, githubId: string) {
  const start = await request.post('/api/auth/sign-in/social', {
    headers: ORIGIN,
    data: { provider: 'github', callbackURL: '/admin/conta/passkeys', errorCallbackURL: '/admin/login?error=github' },
  })
  expect(start.status()).toBe(200)
  const state = new URL((await start.json()).url).searchParams.get('state')
  expect(state).toBeTruthy()
  const callback = await request.get(`/api/auth/callback/github?code=gh-${githubId}&state=${state}`, { maxRedirects: 0 })
  expect(callback.status()).toBe(302)
  return callback.headers().location ?? ''
}

/** In the browser, answer GitHub's authorize page by sending the user straight back with a code */
async function fakeGithubAuthorize(page: Page, githubId: string) {
  await page.route('https://github.com/login/oauth/authorize**', async (route) => {
    const state = new URL(route.request().url()).searchParams.get('state')
    await route.fulfill({ status: 302, headers: { location: `${SITE_ORIGIN}/api/auth/callback/github?code=gh-${githubId}&state=${state}` } })
  })
}

test.beforeAll(async ({ request }) => {
  expect((await request.post('/api/_test/reset-auth', { headers: ORIGIN })).status()).toBe(200)
})

test.describe('before the owner exists', () => {
  test('the bootstrap is open, but only with the right token from this site', async ({ request }) => {
    expect((await request.get('/api/setup')).status()).toBe(200)
    expect((await request.post('/api/setup', { data: { token: BOOTSTRAP_TOKEN } })).status()).toBe(403)
    expect((await request.post('/api/setup', { headers: { origin: 'https://evil.example' }, data: { token: BOOTSTRAP_TOKEN } })).status()).toBe(403)
    expect((await request.post('/api/setup', { headers: ORIGIN, data: { token: 'wrong' } })).status()).toBe(403)
    expect((await request.post('/api/setup', { headers: ORIGIN, data: { token: BOOTSTRAP_TOKEN, extra: 1 } })).status()).toBe(400)
    expect(actions(await authState(request))).toEqual(['auth.bootstrap_rejected'])
  })

  test('GitHub creates no user for an id outside the allowlist, nor for the owner without the bootstrap grant', async ({ request }) => {
    expect(await githubCallback(request, DENIED_GITHUB_ID)).toContain('error=')
    expect(await githubCallback(request, OWNER_GITHUB_ID)).toContain('error=')

    const state = await authState(request)
    expect(state.users).toBe(0)
    expect(state.audit.filter(entry => entry.action === 'auth.github_rejected').map(entry => JSON.parse(entry.metadata ?? '{}').reason))
      .toEqual(['not_allowlisted', 'bootstrap_required'])
  })
})

test('the owner bootstraps, registers a passkey, signs in with it and manages passkeys', async ({ page, context, request }) => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const addAuthenticator = async () => (await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })).authenticatorId
  const firstDevice = await addAuthenticator()
  await fakeGithubAuthorize(page, OWNER_GITHUB_ID)

  // Bootstrap: token, GitHub, passkey
  await page.goto('/admin/setup')
  await page.getByLabel('Token de configuração').fill(BOOTSTRAP_TOKEN)
  await page.getByRole('button', { name: 'Continuar com GitHub' }).click()
  await page.waitForURL(/\/admin\/setup\?step=passkey/)
  await page.getByRole('button', { name: 'Registrar passkey' }).click()
  await page.waitForURL(/\/admin\/conta\/passkeys/)
  await expect(page.getByTestId('passkey-row')).toHaveCount(1)
  expect(await authState(request)).toMatchObject({ users: 1, owners: 1, passkeys: 1 })

  // The bootstrap is gone for good
  expect((await request.get('/api/setup')).status()).toBe(404)
  expect((await request.post('/api/setup', { headers: ORIGIN, data: { token: BOOTSTRAP_TOKEN } })).status()).toBe(404)

  // Sign out, then back in with the passkey
  await page.getByRole('button', { name: 'Sair' }).click()
  await page.waitForURL(/\/admin\/login/)
  await page.getByRole('button', { name: 'Entrar com passkey' }).click()
  await page.waitForURL(/\/admin\/conta\/passkeys/)

  // A second device (WebAuthn refuses a second credential for the same user on one authenticator), then remove one
  // passkey: the session is fresh and GitHub is linked
  await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: firstDevice })
  await addAuthenticator()
  await page.getByRole('button', { name: 'Adicionar passkey' }).click()
  await expect(page.getByText('Passkey adicionada.')).toBeVisible()
  await expect(page.getByTestId('passkey-row')).toHaveCount(2)
  await page.getByRole('button', { name: /^Remover/ }).first().click()
  await expect(page.getByText('Passkey removida.')).toBeVisible()
  await expect(page.getByTestId('passkey-row')).toHaveCount(1)

  expect(actions(await authState(request))).toEqual(expect.arrayContaining([
    'auth.bootstrap_completed',
    'auth.login',
    'auth.passkey_added',
    'auth.passkey_removed',
  ]))
  const logins = (await authState(request)).audit.filter(entry => entry.action === 'auth.login').map(entry => JSON.parse(entry.metadata ?? '{}').method)
  expect(logins).toEqual(['github', 'passkey'])
})

test.describe('after the owner exists', () => {
  test('GitHub signs the owner in again and still rejects anyone else', async ({ request }) => {
    expect(await githubCallback(request, OWNER_GITHUB_ID)).not.toContain('error=')
    expect(await githubCallback(request, DENIED_GITHUB_ID)).toContain('error=')
    expect((await authState(request)).users).toBe(1)
  })

  test('a failed passkey sign-in is audited, with the IP only as an HMAC', async ({ request }) => {
    const ip = '203.0.113.50'
    const response = await request.post('/api/auth/passkey/verify-authentication', {
      headers: { ...ORIGIN, 'cf-connecting-ip': ip },
      data: { response: { id: 'unknown', rawId: 'unknown', type: 'public-key', response: { clientDataJSON: 'e30', authenticatorData: 'AA', signature: 'AA' }, clientExtensionResults: {} } },
    })
    expect(response.status()).toBeGreaterThanOrEqual(400)
    const { audit } = await authState(request)
    const failed = audit.filter(entry => entry.action === 'auth.login_failed').at(-1)
    expect(failed?.ipHash).toBe(createHmac('sha256', IP_HASH_SALT).update(ip).digest('hex'))
    // Never the IP in clear, anywhere in the trail
    expect(JSON.stringify(audit)).not.toContain(ip)
    for (const entry of audit) {
      expect(entry.ipHash ?? '', entry.action).toMatch(/^([0-9a-f]{64})?$/)
    }
  })

  test('removing a passkey needs a fresh session and never removes the last way in', async ({ playwright, baseURL }) => {
    // TEST_AUTH users: no passkey and no GitHub of their own
    const stale = await playwright.request.newContext({ baseURL })
    await stale.post('/api/_test/session?role=viewer&ageSeconds=1000', { headers: ORIGIN })
    const staleResponse = await stale.post('/api/auth/passkey/delete-passkey', { headers: ORIGIN, data: { id: 'any' } })
    expect(staleResponse.status()).toBe(403)
    expect(await staleResponse.json()).toMatchObject({ code: 'SESSION_NOT_FRESH' })

    const fresh = await playwright.request.newContext({ baseURL })
    await fresh.post('/api/_test/session?role=viewer', { headers: ORIGIN })
    const lastResponse = await fresh.post('/api/auth/passkey/delete-passkey', { headers: ORIGIN, data: { id: 'any' } })
    expect(lastResponse.status()).toBe(403)
    expect(await lastResponse.json()).toMatchObject({ code: 'LAST_PASSKEY' })
    await Promise.all([stale.dispose(), fresh.dispose()])
  })
})
