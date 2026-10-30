// Topics (the default) or technologies (?kind=technology, F07-T1) with how many articles or projects use them
// (F06-T1). Every role that reads articles reads projects too, so article:read covers both
import { tagListQuerySchema } from '#shared/content/article-input'
import { listTagsOf } from '../../../services/content/tags.service.ts'

export default defineAdminHandler({
  permission: { article: ['read'] },
  handler: async (event) => {
    const { kind } = getValidatedQueryStrict(event, tagListQuerySchema)
    return { items: await listTagsOf(useDb(event), kind) }
  },
})
