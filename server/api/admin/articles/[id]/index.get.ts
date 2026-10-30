// One article with its working copies, for the editor
import { z } from 'zod'
import { getArticle } from '../../../../services/content/articles.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['read'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    return getArticle(useDb(event), id)
  },
})
