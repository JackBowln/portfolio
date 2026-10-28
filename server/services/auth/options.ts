// Better Auth configuration (ADR-0005). Receives the env and the ports it needs (database queries, audit), never the
// h3 event, so it is unit-tested with fakes. Roles live in ./access.ts; the rules themselves in ./policies.ts
import type { BetterAuthOptions } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { clientIp } from '../../utils/ip-hash.ts'
import { logger } from '../../utils/logger.ts'
import type { AuditEvent } from '../audit/audit.service.ts'
import { ADMIN_PLUGIN_PATHS } from './access.ts'
import { BOOTSTRAP_COOKIE, githubAccessDecision, passkeyRemoval, readCookie, verifyBootstrapGrant } from './policies.ts'

export interface AuthEnv {
  ENVIRONMENT: string
  SITE_URL: string
  BETTER_AUTH_SECRET?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  /** Numeric GitHub user id of the owner: the allowlist (ADR-0005 §2) */
  OWNER_GITHUB_ID?: string
}

/** What the policies need from the outside world; server/utils/auth.ts wires them to D1 */
export interface AuthPorts {
  ownerExists: () => Promise<boolean>
  countPasskeys: (userId: string) => Promise<number>
  hasGithubAccount: (userId: string) => Promise<boolean>
  audit: (event: AuditEvent) => Promise<void>
}

const GITHUB = 'github'

interface HookContext {
  path?: string | undefined
  params?: unknown
  headers?: Headers | undefined
  request?: Request | undefined
}

/** For the audit trail only; the audit service hashes it before storing */
function requestIp(ctx: HookContext | null | undefined): string | null {
  return clientIp(ctx?.headers ?? ctx?.request?.headers)
}

/** Better Auth reports the route pattern (`/callback/:id`), with the provider in the params */
function isGithubCallback(ctx: HookContext | null | undefined): boolean {
  return ctx?.path === '/callback/:id' && (ctx.params as { id?: unknown } | undefined)?.id === GITHUB
}

function loginMethod(ctx: HookContext | null | undefined): string | undefined {
  if (ctx?.path === '/passkey/verify-authentication') {
    return 'passkey'
  }
  return isGithubCallback(ctx) ? GITHUB : undefined
}

/** WebAuthn ties passkeys to the environment's host and origin (ADR-0005 §2): each environment has its own */
export function passkeyOptions(env: Pick<AuthEnv, 'SITE_URL'>) {
  const siteUrl = new URL(env.SITE_URL)
  return {
    rpID: siteUrl.hostname,
    rpName: 'Portfolio admin',
    origin: siteUrl.origin,
    // Discoverable credentials: sign-in needs no username
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  } as const
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

export function authOptions(env: AuthEnv, ports: AuthPorts): Omit<BetterAuthOptions, 'database'> {
  const siteUrl = env.SITE_URL.replace(/\/$/, '')
  const secret = resolveAuthSecret(env)
  const github = env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
    : {}

  return {
    appName: 'portfolio',
    baseURL: siteUrl,
    basePath: '/api/auth',
    secret,
    trustedOrigins: [siteUrl],
    // No passwords and no public sign-up (ADR-0005 §2)
    emailAndPassword: { enabled: false },
    // The admin plugin keeps roles and bans, but its HTTP API stays off (./access.ts)
    disabledPaths: [...ADMIN_PLUGIN_PATHS],
    socialProviders: github,
    account: {
      // No implicit linking by e-mail: a GitHub account joins a user only on its own sign-up or an explicit link
      accountLinking: { enabled: true, disableImplicitLinking: true },
    },
    user: {
      // Runs on GitHub sign-up, sign-in and link. Users are only ever created by GitHub during the owner bootstrap
      // (ADR-0005 §3); afterwards GitHub only signs in the allowlisted owner. Fails closed
      validateUserInfo: async ({ source }, ctx) => {
        if (source.method !== 'oauth' || source.oauth?.providerId !== GITHUB) {
          return { error: 'signup_disabled' }
        }
        const profile = source.oauth.profile as { id?: number | string } | undefined
        const decision = githubAccessDecision({
          action: source.action,
          ownerGithubId: env.OWNER_GITHUB_ID,
          githubId: profile?.id === undefined ? undefined : String(profile.id),
          ownerExists: await ports.ownerExists(),
          bootstrapGranted: await verifyBootstrapGrant(readCookie(ctx.headers?.get('cookie'), BOOTSTRAP_COOKIE), secret, Date.now()),
        })
        if (!decision.allowed) {
          await ports.audit({ action: 'auth.github_rejected', metadata: { reason: decision.reason }, ip: requestIp(ctx) })
          return { error: 'github_not_allowed' }
        }
        return undefined
      },
    },
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
      // IPs are never stored in clear (ADR-0005, F03-T1); only audit_log keeps them, as an HMAC (ADR-0012 §10)
      ipAddress: { disableIpTracking: true },
      database: { generateId: () => uuidv7() },
    },
    databaseHooks: {
      user: {
        create: {
          // validateUserInfo only lets the bootstrap GitHub sign-up through, so that user is the owner
          before: async (user, ctx) => (isGithubCallback(ctx) ? { data: { ...user, role: 'owner' } } : undefined),
          after: async (user, ctx) => {
            if ((user as { role?: string }).role === 'owner') {
              await ports.audit({ action: 'auth.bootstrap_completed', actorUserId: user.id, entityType: 'user', entityId: user.id, ip: requestIp(ctx) })
            }
          },
        },
      },
      // disableIpTracking still writes an empty string; store NULL so "no IP" does not rely on that detail
      session: {
        create: {
          before: async session => ({ data: { ...session, ipAddress: null } }),
          after: async (session, ctx) => {
            const method = loginMethod(ctx)
            if (method) {
              await ports.audit({ action: 'auth.login', actorUserId: session.userId, metadata: { method }, ip: requestIp(ctx) })
            }
          },
        },
        update: { before: async session => ({ data: { ...session, ipAddress: null } }) },
      },
      account: {
        create: {
          before: async (account, ctx) => {
            // Linking counts too: only the allowlisted GitHub id may join any user
            if (account.providerId === GITHUB && account.accountId !== env.OWNER_GITHUB_ID) {
              await ports.audit({ action: 'auth.github_rejected', metadata: { reason: 'not_allowlisted' }, ip: requestIp(ctx) })
              throw new APIError('FORBIDDEN', { code: 'GITHUB_NOT_ALLOWED', message: 'GitHub account not allowed' })
            }
            return { data: withoutOAuthTokens(account) }
          },
        },
        update: { before: async account => ({ data: withoutOAuthTokens(account) }) },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/passkey/delete-passkey') {
          return
        }
        // Without a session the plugin answers 401 itself
        const current = await getSessionFromCtx(ctx)
        if (!current) {
          return
        }
        const userId = current.user.id
        const verdict = passkeyRemoval({
          sessionCreatedAt: new Date(current.session.createdAt),
          nowMs: Date.now(),
          freshAgeSeconds: SESSION_POLICY.freshAge,
          passkeyCount: await ports.countPasskeys(userId),
          hasGithub: await ports.hasGithubAccount(userId),
        })
        if (verdict === 'session_not_fresh') {
          throw new APIError('FORBIDDEN', { code: 'SESSION_NOT_FRESH', message: 'Sign in again to remove a passkey' })
        }
        if (verdict === 'last_passkey') {
          throw new APIError('FORBIDDEN', { code: 'LAST_PASSKEY', message: 'Link GitHub before removing the last passkey' })
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const failed = ctx.context.returned instanceof APIError
        if (ctx.path === '/passkey/verify-authentication' && failed) {
          await ports.audit({ action: 'auth.login_failed', metadata: { method: 'passkey' }, ip: requestIp(ctx) })
          return
        }
        if (failed || (ctx.path !== '/passkey/verify-registration' && ctx.path !== '/passkey/delete-passkey')) {
          return
        }
        const actor = ctx.context.session ?? await getSessionFromCtx(ctx)
        const removed = ctx.path === '/passkey/delete-passkey'
        await ports.audit({
          action: removed ? 'auth.passkey_removed' : 'auth.passkey_added',
          actorUserId: actor?.user.id ?? null,
          entityType: 'passkey',
          ...(removed && typeof ctx.body?.id === 'string' ? { entityId: ctx.body.id } : {}),
          ip: requestIp(ctx),
        })
      }),
    },
    telemetry: { enabled: false },
  }
}
