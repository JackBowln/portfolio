// A named version of the working copy, with an optional note (F06-T2). An author names versions of their own
// articles only; 409 on "version" when the copy changed since the editor read it
import { z } from 'zod'
import { articleVersionSchema } from '#shared/content/article-input'
import { getArticle, saveArticleVersion } from '../../../../../services/content/articles.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['update'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, articleVersionSchema)
    const db = useDb(event)
    const article = await getArticle(db, id)
    assertOwnership(event, { article: ['update'] }, { authorId: article.authorId })
    const result = await saveArticleVersion(db, auth.user.id, article, { version: input.version, note: input.note ?? null })
    if (result.created) {
      await auditRequest(event, { action: 'article.version_saved', entityType: 'article', entityId: id, metadata: { revision: result.revision.number } })
      setResponseStatus(event, 201)
    }
    return result.revision
  },
})
