import { describe, expect, it } from 'vitest'
import type { AuditEvent } from '../../server/services/audit/audit.service'
import { authOptions, passkeyOptions, requireUserVerified, resolveAuthSecret, withoutOAuthTokens } from '../../server/services/auth/options'
import type { AuthPorts } from '../../server/services/auth/options'
import { BOOTSTRAP_COOKIE, createBootstrapGrant } from '../../server/services/auth/policies'

// Throwaway value generated per run; never a real secret
const SECRET = crypto.randomUUID() + crypto.randomUUID()
const OWNER_ID = '4242'
const env = (overrides = {}) => ({
  ENVIRONMENT: 'preview',
  SITE_URL: 'https://portfolio-preview.example.dev',
  BETTER_AUTH_SECRET: SECRET,
  OWNER_GITHUB_ID: OWNER_ID,
  ...overrides,
})

function fakePorts(overrides: Partial<AuthPorts> = {}) {
  const audited: AuditEvent[] = []
  const ports: AuthPorts = {
    ownerExists: async () => false,
    countPasskeys: async () => 1,
    hasGithubAccount: async () => true,
    audit: async (event) => {
      audited.push(event)
    },
    ...overrides,
  }
  return { ports, audited }
}

const options = (overrides = {}, ports = fakePorts().ports) => authOptions(env(overrides), ports)

describe('authOptions', () => {
  it('has no password sign-in or sign-up', () => {
    expect(options().emailAndPassword).toEqual({ enabled: false })
  })

  it('pins base URL and trusted origins to SITE_URL', () => {
    const result = options({ SITE_URL: 'https://x.dev/' })

    expect(result.baseURL).toBe('https://x.dev')
    expect(result.basePath).toBe('/api/auth')
    expect(result.trustedOrigins).toEqual(['https://x.dev'])
  })

  it('uses Secure (__Secure-) cookies on https and plain cookies on localhost', () => {
    expect(options().advanced?.useSecureCookies).toBe(true)
    expect(options({ ENVIRONMENT: 'local', SITE_URL: 'http://localhost:3000' }).advanced?.useSecureCookies).toBe(false)
    expect(options().advanced?.defaultCookieAttributes).toEqual({ httpOnly: true, sameSite: 'lax', path: '/' })
  })

  it('keeps sessions 7 days, renewed daily, with a 5 min cookie cache and 15 min freshness', () => {
    expect(options().session).toEqual({
      expiresIn: 604_800,
      updateAge: 86_400,
      freshAge: 900,
      // No signed session copy in a cookie: revocation and role changes apply on the next request (F03-T5)
      cookieCache: { enabled: false },
    })
  })

  it('disables IP tracking and telemetry', () => {
    const result = options()

    expect(result.advanced?.ipAddress).toEqual({ disableIpTracking: true })
    expect(result.telemetry).toEqual({ enabled: false })
  })

  it('stores sessions without an IP address', async () => {
    const before = options().databaseHooks?.session?.create?.before
    const result = await before?.({ ipAddress: '', userAgent: 'ua' } as never, null)

    expect(result).toEqual({ data: { ipAddress: null, userAgent: 'ua' } })
  })

  it('discards OAuth tokens on account create and update', async () => {
    const hooks = options().databaseHooks?.account
    const account = { providerId: 'github', accountId: OWNER_ID, accessToken: 'a', refreshToken: 'r', idToken: 'i' }

    for (const before of [hooks?.create?.before, hooks?.update?.before]) {
      expect(await before?.(account as never, null)).toEqual({ data: withoutOAuthTokens(account) })
    }
    expect(withoutOAuthTokens(account)).toMatchObject({ accountId: OWNER_ID, accessToken: null, refreshToken: null, idToken: null })
  })

  it('enables GitHub only when both credentials exist, and never links accounts implicitly', () => {
    expect(options().socialProviders).toEqual({})
    expect(options({ GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' }).socialProviders).toEqual({ github: { clientId: 'id', clientSecret: 'secret' } })
    expect(options().account?.accountLinking).toEqual({ enabled: true, disableImplicitLinking: true })
  })
})

describe('GitHub gate', () => {
  async function signUp(githubId: number, { ownerExists = false, grant = true, action = 'create-user' } = {}) {
    const { ports, audited } = fakePorts({ ownerExists: async () => ownerExists })
    const validate = authOptions(env(), ports).user?.validateUserInfo
    const cookie = grant ? `${BOOTSTRAP_COOKIE}=${await createBootstrapGrant(SECRET, Date.now())}` : ''
    const ctx = { headers: new Headers({ cookie, 'cf-connecting-ip': '203.0.113.7' }) }
    const result = await validate?.({ user: {}, source: { method: 'oauth', action, oauth: { providerId: 'github', profile: { id: githubId } } } } as never, ctx as never)
    return { result, audited }
  }

  it('lets only the allowlisted owner sign up, during the bootstrap', async () => {
    expect((await signUp(Number(OWNER_ID))).result).toBeUndefined()
  })

  it('signs the owner in afterwards, without a grant, and still turns anyone else away', async () => {
    expect((await signUp(Number(OWNER_ID), { ownerExists: true, grant: false, action: 'sign-in' })).result).toBeUndefined()
    expect((await signUp(1, { ownerExists: true, grant: false, action: 'sign-in' })).result).toEqual({ error: 'github_not_allowed' })
  })

  it('rejects any other case without creating the user, and audits it', async () => {
    for (const [id, state, reason] of [
      [1, {}, 'not_allowlisted'],
      [Number(OWNER_ID), { ownerExists: true }, 'owner_exists'],
      [Number(OWNER_ID), { grant: false }, 'bootstrap_required'],
    ] as const) {
      const { result, audited } = await signUp(id, state)
      expect(result, reason).toEqual({ error: 'github_not_allowed' })
      // The raw IP goes to the audit port, which hashes it before storing (audit.service.ts)
      expect(audited, reason).toEqual([{ action: 'auth.github_rejected', metadata: { reason }, ip: '203.0.113.7' }])
    }
  })

  it('rejects every sign-up that is not GitHub', async () => {
    const validate = options().user?.validateUserInfo
    const result = await validate?.({ user: {}, source: { method: 'test-auth', action: 'create-user' } } as never, { headers: new Headers() } as never)
    expect(result).toEqual({ error: 'signup_disabled' })
  })

  it('refuses to link a GitHub account outside the allowlist', async () => {
    const { ports, audited } = fakePorts()
    const before = authOptions(env(), ports).databaseHooks?.account?.create?.before
    await expect(before?.({ providerId: 'github', accountId: '1' } as never, null)).rejects.toMatchObject({ statusCode: 403 })
    expect(audited).toEqual([{ action: 'auth.github_rejected', metadata: { reason: 'not_allowlisted' }, ip: null }])
  })

  it('makes the bootstrap GitHub sign-up the owner, and only that one', async () => {
    const before = options().databaseHooks?.user?.create?.before
    expect(await before?.({ name: 'x' } as never, { path: '/callback/:id', params: { id: 'github' } } as never)).toEqual({ data: { name: 'x', role: 'owner' } })
    expect(await before?.({ name: 'x' } as never, { path: '/callback/:id', params: { id: 'google' } } as never)).toBeUndefined()
    expect(await before?.({ name: 'x' } as never, { path: '/test-auth/sign-in' } as never)).toBeUndefined()
  })
})

describe('passkeyOptions', () => {
  it('binds passkeys to the environment host and origin', () => {
    expect(passkeyOptions({ SITE_URL: 'https://portfolio-preview.example.dev/' })).toMatchObject({
      rpID: 'portfolio-preview.example.dev',
      origin: 'https://portfolio-preview.example.dev',
      authenticatorSelection: { residentKey: 'required' },
    })
    expect(passkeyOptions({ SITE_URL: 'http://localhost:8787' })).toMatchObject({ rpID: 'localhost', origin: 'http://localhost:8787' })
  })

  it('requires user verification on registration and sign-in (F12-T3)', () => {
    const options = passkeyOptions({ SITE_URL: 'https://example.dev' })
    expect(options.authenticatorSelection.userVerification).toBe('required')
    expect(() => options.registration.afterVerification({ verification: { registrationInfo: { userVerified: false } } })).toThrow('must verify you')
    expect(() => options.authentication.afterVerification({ verification: { authenticationInfo: { userVerified: false } } })).toThrow('must verify you')
    expect(() => options.authentication.afterVerification({ verification: {} })).toThrow('must verify you')
    expect(options.registration.afterVerification({ verification: { registrationInfo: { userVerified: true } } })).toBeUndefined()
    expect(() => requireUserVerified(true)).not.toThrow()
  })
})

describe('resolveAuthSecret', () => {
  it('requires the secret outside local', () => {
    expect(() => resolveAuthSecret(env({ BETTER_AUTH_SECRET: undefined }))).toThrow('BETTER_AUTH_SECRET is not set')
    expect(() => resolveAuthSecret(env({ ENVIRONMENT: 'production', BETTER_AUTH_SECRET: '' }))).toThrow()
  })

  it('rejects short secrets', () => {
    expect(() => resolveAuthSecret(env({ BETTER_AUTH_SECRET: 'short' }))).toThrow('at least 32')
  })

  it('uses one random secret per isolate locally when none is set', () => {
    const local = env({ ENVIRONMENT: 'local', BETTER_AUTH_SECRET: undefined })
    const first = resolveAuthSecret(local)

    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(resolveAuthSecret(local)).toBe(first)
  })
})
