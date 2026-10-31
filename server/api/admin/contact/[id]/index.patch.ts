// Moves a contact message to read, archived or spam (F08-T3); audited with the id and the state, never the content
import { z } from 'zod'
import { contactStatusSchema } from '#shared/contact/schemas'
import { changeContactStatus } from '../../../../services/contact/contact.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { contact: ['update'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { status } = await readValidatedBodyStrict(event, contactStatusSchema)
    const message = await changeContactStatus(useDb(event), id, status)
    await auditRequest(event, { action: 'contact.status_changed', entityType: 'contact_message', entityId: id, metadata: { status } })
    return message
  },
})
