// A new draft from its title alone (F06-T1, decision 4); the editor opens it right after
import { articleCreateSchema } from '#shared/content/article-input'
import { createArticle } from '../../../services/content/articles.service.ts'

export default defineAdminHandler({
  permission: { article: ['create'] },
  handler: async (event, auth) => {
    const { title } = await readValidatedBodyStrict(event, articleCreateSchema)
    const article = await createArticle(useDb(event), auth.user.id, title)
    await auditRequest(event, { action: 'article.created', entityType: 'article', entityId: article.id })
    setResponseStatus(event, 201)
    return article
  },
})
