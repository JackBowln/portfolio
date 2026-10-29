// Revokes one of the user's other sessions (RF-03.5); it fails its next request. The current one ends by signing out
import { z } from 'zod'
import { revokeOwnSession } from '../../../services/auth/sessions.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { session: ['revoke'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { user, session } = requireAdminAuth(event)
    const result = await revokeOwnSession(useDb(event), user, session.id, id)
    if (result === 'current') {
      throw createAppError('bad_request', 'Sign out to end the current session')
    }
    if (result === 'not_found') {
      throw createAppError('not_found')
    }
    await auditRequest(event, { action: 'auth.session_revoked', entityType: 'session', entityId: id })
    return { ok: true }
  },
})
