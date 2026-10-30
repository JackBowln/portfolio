// Topics with how many articles use them (F06-T1); reading them follows article:read
import { listTopics } from '../../../services/content/tags.service.ts'

export default defineAdminHandler({
  permission: { article: ['read'] },
  handler: async event => ({ items: await listTopics(useDb(event)) }),
})
