// TEST_AUTH — test-only (PORTFOLIO_TEST_BUILD=1, never in a deploy build): creates a throwaway user and session with
// the real auth options, so tests can check the session cookie Better Auth emits. There is no login method until F03-T2
import { betterAuth } from 'better-auth'
import type { BetterAuthPlugin } from 'better-auth'
import { createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { authOptions } from '../../services/auth/options.ts'

const testAuthPlugin = {
  id: 'test-auth',
  endpoints: {
    testSignIn: createAuthEndpoint('/test-auth/sign-in', { method: 'POST' }, async (ctx) => {
      const user = await ctx.context.internalAdapter.createUser({
        name: 'TEST_AUTH user',
        email: `test-${crypto.randomUUID()}@example.test`,
        emailVerified: true,
      }, { method: 'test-auth' })
      const session = await ctx.context.internalAdapter.createSession(user.id)
      await setSessionCookie(ctx, { session, user })
      return ctx.json({ userId: user.id })
    }),
  },
} satisfies BetterAuthPlugin

export default defineEventHandler((event) => {
  const env = useEnv(event)
  const auth = betterAuth({ ...authOptions(env), database: authDatabase(env), plugins: [testAuthPlugin] })
  return auth.handler(new Request(`${env.SITE_URL.replace(/\/$/, '')}/api/auth/test-auth/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'origin': env.SITE_URL },
    body: '{}',
  }))
})
