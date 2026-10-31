// Deletes a contact message for good (F08-T3, decision 4): personal data, nothing kept but the audit entry with the id
import { z } from 'zod'
import { removeContactMessage } from '../../../../services/contact/contact.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { contact: ['delete'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    await removeContactMessage(useDb(event), id)
    await auditRequest(event, { action: 'contact.deleted', entityType: 'contact_message', entityId: id })
    return { ok: true }
  },
})
