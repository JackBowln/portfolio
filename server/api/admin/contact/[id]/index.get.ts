// One contact message (F08-T3); opening a new one marks it read
import { z } from 'zod'
import { openContactMessage } from '../../../../services/contact/contact.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { contact: ['read'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    return openContactMessage(useDb(event), id)
  },
})
