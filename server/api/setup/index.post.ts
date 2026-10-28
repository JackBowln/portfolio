// Exchanges the BOOTSTRAP_TOKEN for a short-lived signed grant cookie, read by the GitHub sign-up (ADR-0005 §3).
// The origin middleware arrives in F03-T4, so this anonymous mutation checks the Origin itself
import { z } from 'zod'
import { startBootstrap } from '../../services/auth/bootstrap.service.ts'
import { BOOTSTRAP_COOKIE, BOOTSTRAP_GRANT_SECONDS } from '../../services/auth/policies.ts'

const bodySchema = z.object({ token: z.string().min(1).max(256) })

export default defineEventHandler(async (event) => {
  const env = useEnv(event)
  const siteOrigin = new URL(env.SITE_URL).origin
  if (getRequestHeader(event, 'origin') !== siteOrigin) {
    throw createAppError('forbidden')
  }
  const { token } = await readValidatedBodyStrict(event, bodySchema)

  const result = await startBootstrap(useDb(event), env, token)
  if (result.status === 'closed') {
    throw createAppError('not_found')
  }
  if (result.status === 'invalid_token') {
    throw createAppError('forbidden')
  }
  // Sent only to /api/auth, where the GitHub callback reads it; Lax lets it ride the top-level redirect back
  setCookie(event, BOOTSTRAP_COOKIE, result.grant, {
    httpOnly: true,
    secure: siteOrigin.startsWith('https://'),
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: BOOTSTRAP_GRANT_SECONDS,
  })
  return { ok: true }
})
