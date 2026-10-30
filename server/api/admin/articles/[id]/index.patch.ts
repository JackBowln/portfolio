// Saves the pt-BR working copy and the article's cover, topics and featured flag (F06-T1), as the editor's autosave
// (F06-T2): each save records an autosave revision, dropped when it repeats the latest. The body carries the version
// the editor read: 409 on "version" when it changed since, 409 on "slug" when the slug is taken. An author edits
// only their own articles. Not in the audit log (decision 4): the autosave revision records who saved and when
import { z } from 'zod'
import { articleUpdateSchema } from '#shared/content/article-input'
import { getArticle, updateArticle } from '../../../../services/content/articles.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['update'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, articleUpdateSchema)
    const db = useDb(event)
    const article = await getArticle(db, id)
    assertOwnership(event, { article: ['update'] }, { authorId: article.authorId })
    return updateArticle(db, auth.user.id, article, input)
  },
})
