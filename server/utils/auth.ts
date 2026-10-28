// Must stay the first import: @simplewebauthn/server pulls @peculiar/x509 → tsyringe, which throws at load time unless
// the Reflect metadata API exists, and nothing else installs it in the Worker
import 'reflect-metadata'
import type { H3Event } from 'h3'
import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createDb } from '../db/client.ts'
import { accounts, passkeys, sessions, users, verifications } from '../db/schema/auth.ts'
import { recordAudit } from '../services/audit/audit.service.ts'
import { adminPlugin } from '../services/auth/access.ts'
import { countPasskeys, hasLinkedAccount, ownerExists } from '../services/auth/auth.repo.ts'
import { authOptions, passkeyOptions } from '../services/auth/options.ts'
import type { AuthPorts } from '../services/auth/options.ts'

export function authDatabase(env: Env) {
  return drizzleAdapter(createDb(env.DB), {
    provider: 'sqlite',
    usePlural: true,
    schema: { users, sessions, accounts, verifications, passkeys },
  })
}

/** The auth policies' queries and audit trail, over this env's D1 */
export function authPorts(env: Env): AuthPorts {
  const db = createDb(env.DB)
  return {
    ownerExists: () => ownerExists(db),
    countPasskeys: userId => countPasskeys(db, userId),
    hasGithubAccount: userId => hasLinkedAccount(db, userId, 'github'),
    audit: event => recordAudit(db, event, env.IP_HASH_SALT),
  }
}

// A tuple, not an array, so Better Auth infers each plugin's fields (the admin plugin's `role`)
type AuthPlugins = [ReturnType<typeof adminPlugin>, ReturnType<typeof passkey>]

export function authPlugins(env: Env): AuthPlugins {
  return [adminPlugin(), passkey(passkeyOptions(env))]
}

function buildAuth(env: Env) {
  return betterAuth({ ...authOptions(env, authPorts(env)), database: authDatabase(env), plugins: authPlugins(env) })
}

export type Auth = ReturnType<typeof buildAuth>

// The D1 binding lives on the Worker env, so the instance is built from it; it is reused while the isolate keeps
// the same env object instead of being rebuilt on every request
const instances = new WeakMap<Env, Auth>()

export function createAuth(env: Env): Auth {
  let auth = instances.get(env)
  if (!auth) {
    auth = buildAuth(env)
    instances.set(env, auth)
  }
  return auth
}

export function useAuth(event: H3Event): Auth {
  return createAuth(useEnv(event))
}
