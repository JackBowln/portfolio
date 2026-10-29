// Audit log (RF-02.4): filter by period, actor and action, newest first, one page at a time. Never returns ip_hash
import { z } from 'zod'
import { AUDIT_ACTIONS } from '#shared/audit/actions'
import { queryAudit } from '../../services/audit/audit.service.ts'

const querySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  actor: z.string().min(1).max(64).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export default defineAdminHandler({
  permission: { audit: ['read'] },
  handler: async (event) => {
    const query = getValidatedQueryStrict(event, querySchema)
    return queryAudit(useDb(event), query)
  },
})
