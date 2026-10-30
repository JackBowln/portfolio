// Article list (F06-T1): newest change first, filtered by the status, locale or translation state of a
// localization, one page at a time
import { articleListQuerySchema } from '#shared/content/article-input'
import { listArticles } from '../../../services/content/articles.service.ts'

export default defineAdminHandler({
  permission: { article: ['read'] },
  handler: async (event) => {
    const { cursor, limit, ...filters } = getValidatedQueryStrict(event, articleListQuerySchema)
    return listArticles(useDb(event), filters, cursor, limit)
  },
})
