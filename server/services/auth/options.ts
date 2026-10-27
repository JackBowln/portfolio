// Better Auth configuration (ADR-0005). Pure: receives the env and the database, never the h3 event, so it is
// unit-tested. Login methods arrive in F03-T2 (passkey, GitHub allowlist); roles live in ./access.ts
import type { BetterAuthOptions } from 'better-auth'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { logger } from '../../utils/logger.ts'
import { ADMIN_PLUGIN_PATHS } from './access.ts'

export interface AuthEnv {
  ENVIRONMENT: string
  SITE_URL: string
  BETTER_AUTH_SECRET?: string
}

export const SESSION_POLICY = {
  // 7 days, renewed after 24 h of use
  expiresIn: 7 * 24 * 60 * 60,
  updateAge: 24 * 60 * 60,
  // Sensitive actions (roles, deleting published content, AI budget, removing a passkey) need a session this fresh
  freshAge: 15 * 60,
  // Signed session copy in a cookie, so most admin requests skip the D1 read; revocation takes up to this long
  cookieCacheMaxAge: 5 * 60,
} as const

const MIN_SECRET_LENGTH = 32

let ephemeralSecret: string | undefined

/** BETTER_AUTH_SECRET is required outside local; local dev, tests and CI get a random per-isolate secret */
export function resolveAuthSecret(env: AuthEnv): string {
  if (env.BETTER_AUTH_SECRET) {
    if (env.BETTER_AUTH_SECRET.length < MIN_SECRET_LENGTH) {
      throw new Error(`BETTER_AUTH_SECRET must have at least ${MIN_SECRET_LENGTH} characters`)
    }
    return env.BETTER_AUTH_SECRET
  }
  if (env.ENVIRONMENT !== 'local') {
    throw new Error('BETTER_AUTH_SECRET is not set')
  }
  if (!ephemeralSecret) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    ephemeralSecret = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
    logger.warn('auth.ephemeral_secret', { reason: 'BETTER_AUTH_SECRET not set; sessions end when the isolate restarts' })
  }
  return ephemeralSecret
}

type AccountTokens = Partial<Record<'accessToken' | 'refreshToken' | 'idToken', string | null | undefined>>
  & Partial<Record<'accessTokenExpiresAt' | 'refreshTokenExpiresAt', Date | null | undefined>>

/** GitHub tokens are not needed after login (only the numeric account id is), so they are never stored (ADR-0005) */
export function withoutOAuthTokens<T extends AccountTokens>(account: T): T {
  return {
    ...account,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  }
}

export function authOptions(env: AuthEnv): Omit<BetterAuthOptions, 'database'> {
  const siteUrl = env.SITE_URL.replace(/\/$/, '')
  return {
    appName: 'portfolio',
    baseURL: siteUrl,
    basePath: '/api/auth',
    secret: resolveAuthSecret(env),
    trustedOrigins: [siteUrl],
    // No passwords and no public sign-up (ADR-0005 §2)
    emailAndPassword: { enabled: false },
    // The admin plugin keeps roles and bans, but its HTTP API stays off (./access.ts)
    disabledPaths: [...ADMIN_PLUGIN_PATHS],
    session: {
      expiresIn: SESSION_POLICY.expiresIn,
      updateAge: SESSION_POLICY.updateAge,
      freshAge: SESSION_POLICY.freshAge,
      cookieCache: { enabled: true, maxAge: SESSION_POLICY.cookieCacheMaxAge },
    },
    advanced: {
      // https → Secure cookies with the __Secure- prefix; plain http only on localhost
      useSecureCookies: siteUrl.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      // IPs are never stored in clear (ADR-0005, F03-T1); the audit log keeps a hash (F03-T4)
      ipAddress: { disableIpTracking: true },
      database: { generateId: () => uuidv7() },
    },
    databaseHooks: {
      // disableIpTracking still writes an empty string; store NULL so "no IP" does not rely on that detail
      session: {
        create: { before: async session => ({ data: { ...session, ipAddress: null } }) },
        update: { before: async session => ({ data: { ...session, ipAddress: null } }) },
      },
      account: {
        create: { before: async account => ({ data: withoutOAuthTokens(account) }) },
        update: { before: async account => ({ data: withoutOAuthTokens(account) }) },
      },
    },
    telemetry: { enabled: false },
  }
}
