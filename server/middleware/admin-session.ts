// /api/admin/** needs a session (ADR-0005 §6): 401 without one. Permissions are checked per handler
// (defineAdminHandler); this only authenticates and leaves the user on event.context.auth.
// Each call reads the session from D1 (no cookie cache, F03-T5), so a revoked session fails here at once.
// RL_ADMIN (ADR-0012 §6) counts per session, so it needs the session first
const ADMIN_API = '/api/admin'

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0] ?? event.path
  if (path !== ADMIN_API && !path.startsWith(`${ADMIN_API}/`)) {
    return
  }

  const { headers, response } = await useAuth(event).api.getSession({ headers: event.headers, returnHeaders: true })
  // A session past updateAge is renewed during this call; its refreshed cookies go back to the browser
  for (const cookie of headers.getSetCookie()) {
    appendResponseHeader(event, 'set-cookie', cookie)
  }
  if (!response) {
    throw createAppError('unauthorized')
  }

  const { user, session } = response
  event.context.auth = {
    // A missing role grants nothing (permissions.ts knows no empty role)
    user: { id: user.id, role: user.role ?? '', name: user.name, email: user.email },
    session: { id: session.id, createdAt: new Date(session.createdAt) },
  }
  await enforceRateLimit(event, useEnv(event).RL_ADMIN, session.id, 'RL_ADMIN')
})
