// Back to an older pt-BR revision (F06-T2, RF-05.6): the working copy takes its content and a `restore` revision is
// recorded; no revision is deleted. An author restores only their own articles
import { z } from 'zod'
import { articleRestoreSchema } from '#shared/content/article-input'
import { getArticle, restoreArticleRevision } from '../../../../services/content/articles.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['restore'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, articleRestoreSchema)
    const db = useDb(event)
    const article = await getArticle(db, id)
    assertOwnership(event, { article: ['restore'] }, { authorId: article.authorId })
    const { article: restored, restored: number } = await restoreArticleRevision(db, auth.user.id, article, input)
    await auditRequest(event, { action: 'article.restored', entityType: 'article', entityId: id, metadata: { revision: number } })
    return restored
  },
})
