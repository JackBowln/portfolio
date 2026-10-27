import type { H3Event } from 'h3'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createDb } from '../db/client.ts'
import { accounts, sessions, users, verifications } from '../db/schema/auth.ts'
import { adminPlugin } from '../services/auth/access.ts'
import { authOptions } from '../services/auth/options.ts'

export function authDatabase(env: Env) {
  return drizzleAdapter(createDb(env.DB), {
    provider: 'sqlite',
    usePlural: true,
    schema: { users, sessions, accounts, verifications },
  })
}

function buildAuth(env: Env) {
  return betterAuth({ ...authOptions(env), database: authDatabase(env), plugins: [adminPlugin()] })
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
