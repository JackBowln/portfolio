// One revision with its snapshot, for the diff the admin computes in the browser (F06-T2)
import { z } from 'zod'
import { getArticle, getArticleRevision } from '../../../../../services/content/articles.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64), revisionId: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['read'] },
  handler: async (event) => {
    const { id, revisionId } = getValidatedParamsStrict(event, paramsSchema)
    const db = useDb(event)
    return getArticleRevision(db, await getArticle(db, id), revisionId)
  },
})
