import { describe, expect, it } from 'vitest'
import { authOptions, resolveAuthSecret, SESSION_POLICY, withoutOAuthTokens } from '../../server/services/auth/options'

// Throwaway value generated per run; never a real secret
const SECRET = crypto.randomUUID() + crypto.randomUUID()
const env = (overrides = {}) => ({ ENVIRONMENT: 'preview', SITE_URL: 'https://portfolio-preview.example.dev', BETTER_AUTH_SECRET: SECRET, ...overrides })

describe('authOptions', () => {
  it('has no password sign-in or sign-up', () => {
    expect(authOptions(env()).emailAndPassword).toEqual({ enabled: false })
  })

  it('pins base URL and trusted origins to SITE_URL', () => {
    const options = authOptions(env({ SITE_URL: 'https://x.dev/' }))

    expect(options.baseURL).toBe('https://x.dev')
    expect(options.basePath).toBe('/api/auth')
    expect(options.trustedOrigins).toEqual(['https://x.dev'])
  })

  it('uses Secure (__Secure-) cookies on https and plain cookies on localhost', () => {
    expect(authOptions(env()).advanced?.useSecureCookies).toBe(true)
    expect(authOptions(env({ ENVIRONMENT: 'local', SITE_URL: 'http://localhost:3000' })).advanced?.useSecureCookies).toBe(false)
    expect(authOptions(env()).advanced?.defaultCookieAttributes).toEqual({ httpOnly: true, sameSite: 'lax', path: '/' })
  })

  it('keeps sessions 7 days, renewed daily, with a 5 min cookie cache and 15 min freshness', () => {
    expect(authOptions(env()).session).toEqual({
      expiresIn: 604_800,
      updateAge: 86_400,
      freshAge: 900,
      cookieCache: { enabled: true, maxAge: 300 },
    })
    expect(SESSION_POLICY.cookieCacheMaxAge).toBe(300)
  })

  it('disables IP tracking and telemetry', () => {
    const options = authOptions(env())

    expect(options.advanced?.ipAddress).toEqual({ disableIpTracking: true })
    expect(options.telemetry).toEqual({ enabled: false })
  })

  it('stores sessions without an IP address', async () => {
    const before = authOptions(env()).databaseHooks?.session?.create?.before
    const result = await before?.({ ipAddress: '', userAgent: 'ua' } as never, null)

    expect(result).toEqual({ data: { ipAddress: null, userAgent: 'ua' } })
  })

  it('discards OAuth tokens on account create and update', async () => {
    const hooks = authOptions(env()).databaseHooks?.account
    const account = { providerId: 'github', accountId: '1', accessToken: 'a', refreshToken: 'r', idToken: 'i' }

    for (const before of [hooks?.create?.before, hooks?.update?.before]) {
      expect(await before?.(account as never, null)).toEqual({ data: withoutOAuthTokens(account) })
    }
    expect(withoutOAuthTokens(account)).toMatchObject({ accountId: '1', accessToken: null, refreshToken: null, idToken: null })
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
