// Schedule a localization (F06-T4): stored in UTC, published by the cron within 5 minutes of the time
import { z } from 'zod'
import { articleScheduleSchema } from '#shared/content/article-input'
import { getArticle } from '../../../../services/content/articles.service.ts'
import { scheduleArticle } from '../../../../services/content/publishing.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['schedule'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { locale, version, at } = await readValidatedBodyStrict(event, articleScheduleSchema)
    const db = useDb(event)
    const when = new Date(at)
    const article = await scheduleArticle(db, await getArticle(db, id), locale, version, when)
    await auditRequest(event, { action: 'article.scheduled', entityType: 'article', entityId: id, metadata: { locale, at: when.toISOString() } })
    return article
  },
})
