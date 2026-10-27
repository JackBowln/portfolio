// TEST_AUTH — test-only (PORTFOLIO_TEST_BUILD=1, never in a deploy build): creates a throwaway user and session with
// the real auth options, so tests can check the session cookie Better Auth emits and sign in with any role.
// There is no login method until F03-T2. `?role=` picks the role (default viewer); `?ageSeconds=` backdates the session
import { betterAuth } from 'better-auth'
import type { BetterAuthPlugin } from 'better-auth'
import { createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'
import { ROLES } from '#shared/types/enums'
import { adminPlugin } from '../../services/auth/access.ts'
import { authOptions } from '../../services/auth/options.ts'

const querySchema = z.object({
  role: z.enum(ROLES).default('viewer'),
  ageSeconds: z.coerce.number().int().min(0).max(24 * 60 * 60).default(0),
})

const bodySchema = querySchema.required()

const testAuthPlugin = {
  id: 'test-auth',
  endpoints: {
    testSignIn: createAuthEndpoint('/test-auth/sign-in', { method: 'POST', body: bodySchema }, async (ctx) => {
      const user = await ctx.context.internalAdapter.createUser({
        name: 'TEST_AUTH user',
        email: `test-${crypto.randomUUID()}@example.test`,
        emailVerified: true,
        role: ctx.body.role,
      }, { method: 'test-auth' })
      const createdAt = new Date(Date.now() - ctx.body.ageSeconds * 1000)
      const session = await ctx.context.internalAdapter.createSession(user.id, false, { createdAt }, true)
      await setSessionCookie(ctx, { session, user })
      return ctx.json({ userId: user.id })
    }),
  },
} satisfies BetterAuthPlugin

export default defineEventHandler((event) => {
  const query = getValidatedQueryStrict(event, querySchema)
  const env = useEnv(event)
  const auth = betterAuth({ ...authOptions(env), database: authDatabase(env), plugins: [adminPlugin(), testAuthPlugin] })
  return auth.handler(new Request(`${env.SITE_URL.replace(/\/$/, '')}/api/auth/test-auth/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'origin': env.SITE_URL },
    body: JSON.stringify(query),
  }))
})
