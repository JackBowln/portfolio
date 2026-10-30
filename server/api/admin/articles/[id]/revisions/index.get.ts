// The pt-BR history of an article, newest first (F06-T2); snapshots are read one at a time
import { z } from 'zod'
import { getArticle, listArticleRevisions } from '../../../../../services/content/articles.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['read'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const db = useDb(event)
    return { items: await listArticleRevisions(db, await getArticle(db, id)) }
  },
})
