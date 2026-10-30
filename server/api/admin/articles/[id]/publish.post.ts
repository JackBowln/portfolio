// Publish a localization now (F06-T4): one atomic batch, then the purge of ADR-0003's tags. 409 with the reason
// when a guard fails (translation not approved, pt-BR not published, image without alt, slug taken on the site)
import { z } from 'zod'
import { articlePublishSchema } from '#shared/content/article-input'
import { getArticle } from '../../../../services/content/articles.service.ts'
import { publishArticle } from '../../../../services/content/publishing.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['publish'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { locale, version } = await readValidatedBodyStrict(event, articlePublishSchema)
    const db = useDb(event)
    const { article, purge } = await publishArticle(db, publishActor(event, auth.user.id), await getArticle(db, id), locale, version)
    await purgeAfterWrite(event, purge)
    return article
  },
})
