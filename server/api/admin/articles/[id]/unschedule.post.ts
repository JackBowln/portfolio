// Cancel a schedule (F06-T4): the localization goes back to draft
import { z } from 'zod'
import { articleLocaleSchema } from '#shared/content/article-input'
import { getArticle } from '../../../../services/content/articles.service.ts'
import { unscheduleArticle } from '../../../../services/content/publishing.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['schedule'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { locale } = await readValidatedBodyStrict(event, articleLocaleSchema)
    const db = useDb(event)
    const article = await unscheduleArticle(db, await getArticle(db, id), locale)
    await auditRequest(event, { action: 'article.unscheduled', entityType: 'article', entityId: id, metadata: { locale } })
    return article
  },
})
