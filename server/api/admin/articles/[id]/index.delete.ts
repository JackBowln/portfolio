// Soft delete (F06-T1, decision 2): 409 while a localization is published; an author deletes only their own drafts
import { z } from 'zod'
import { SOURCE_LOCALE } from '#shared/types/enums'
import { deleteArticle, getArticle } from '../../../../services/content/articles.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['delete'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const db = useDb(event)
    const article = await getArticle(db, id)
    const status = article.localizations.find(item => item.locale === SOURCE_LOCALE)?.status ?? 'draft'
    assertOwnership(event, { article: ['delete'] }, { authorId: article.authorId, status })
    await deleteArticle(db, auth.user.id, article)
    await auditRequest(event, { action: 'article.deleted', entityType: 'article', entityId: id })
    return { ok: true }
  },
})
