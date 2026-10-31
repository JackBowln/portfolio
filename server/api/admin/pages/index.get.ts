// The institutional pages with their state (F08-T2); each is created on first need
import { listPages } from '../../../services/content/pages.service.ts'

export default defineAdminHandler({
  permission: { page: ['read'] },
  handler: async event => listPages(useDb(event)),
})
