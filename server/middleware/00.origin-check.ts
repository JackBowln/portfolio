// CSRF and input envelope for every state-changing API call (ADR-0012 §2, §4). Runs before the session middleware,
// so a cross-site request is refused without touching D1. Better Auth checks origins too; this is the outer layer
import type { H3Event } from 'h3'

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
// Better Auth parses its own bodies; these routes take JSON only (uploads get their own exception in F04)
const JSON_ONLY = ['/api/admin', '/api/public', '/api/setup']

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** Origin first; browsers that omit it on same-origin requests still send Sec-Fetch-Site */
function isSameSite(event: H3Event, siteOrigin: string): boolean {
  const origin = getRequestHeader(event, 'origin')
  if (origin) {
    return origin === siteOrigin
  }
  return getRequestHeader(event, 'sec-fetch-site') === 'same-origin'
}

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0] ?? event.path
  if (!MUTATIONS.has(event.method) || !under(path, '/api')) {
    return
  }

  if (!isSameSite(event, new URL(useEnv(event).SITE_URL).origin)) {
    throw createAppError('forbidden', 'Cross-site request')
  }

  const contentLength = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (contentLength > MAX_JSON_BYTES) {
    throw createAppError('payload_too_large')
  }

  // A bodiless DELETE needs no type; anything carrying a body (an HTML form always does) must be JSON
  const contentType = getRequestHeader(event, 'content-type')
  const hasBody = contentLength > 0 || getRequestHeader(event, 'transfer-encoding') !== undefined
  if (JSON_ONLY.some(prefix => under(path, prefix)) && (contentType !== undefined || hasBody)
    && !/^application\/json(;|$)/i.test(contentType ?? '')) {
    throw createAppError('unsupported_media_type')
  }
})
