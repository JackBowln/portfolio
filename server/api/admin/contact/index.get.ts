// Contact inbox (F08-T3): newest first, filtered by state, one page at a time; never the IP hash
import { contactListQuerySchema } from '#shared/contact/schemas'
import { listInbox } from '../../../services/contact/contact.service.ts'

export default defineAdminHandler({
  permission: { contact: ['read'] },
  handler: async (event) => {
    const query = getValidatedQueryStrict(event, contactListQuerySchema)
    return listInbox(useDb(event), query)
  },
})
