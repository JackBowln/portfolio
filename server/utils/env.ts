import type { H3Event } from 'h3'

/** Cloudflare bindings for this request, typed from wrangler.jsonc (`pnpm cf:types`) */
export function useEnv(event: H3Event): Env {
  const env = event.context.cloudflare?.env as Env | undefined
  if (!env) {
    throw createError({ statusCode: 500, statusMessage: 'Cloudflare bindings unavailable' })
  }
  return env
}
