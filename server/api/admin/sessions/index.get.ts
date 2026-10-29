// The signed-in user's active sessions (RF-03.5), without their tokens
import { listOwnSessions } from '../../../services/auth/sessions.service.ts'

export default defineAdminHandler({
  permission: { session: ['read'] },
  handler: async (event) => {
    const { user, session } = requireAdminAuth(event)
    return { sessions: await listOwnSessions(useDb(event), user, session.id) }
  },
})
