// RL_AUTH (ADR-0012 §6): 10 per 60 s for each IP on each sign-in route. Covers every Better Auth mutation, the
// OAuth callback and the bootstrap; reads like get-session stay unlimited. RL_ADMIN is applied per session in
// ./admin-session.ts, once the session is known
function isAuthAttempt(method: string, path: string): boolean {
  if (path === '/api/setup') {
    return method === 'POST'
  }
  if (!path.startsWith('/api/auth/')) {
    return false
  }
  return method === 'POST' || path.startsWith('/api/auth/callback/')
}

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0] ?? event.path
  if (!isAuthAttempt(event.method, path)) {
    return
  }
  // The key is the raw IP, which stays inside Cloudflare's counter and is never stored by us
  const ip = clientIp(event.headers) ?? 'unknown'
  await enforceRateLimit(event, useEnv(event).RL_AUTH, `${ip}:${path}`, 'RL_AUTH')
})
