// Take a localization off the site (F06-T4); pt-BR takes its published translations with it. Revisions stay
import { z } from 'zod'
import { articleLocaleSchema } from '#shared/content/article-input'
import { getArticle } from '../../../../services/content/articles.service.ts'
import { unpublishArticle } from '../../../../services/content/publishing.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['publish'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { locale } = await readValidatedBodyStrict(event, articleLocaleSchema)
    const db = useDb(event)
    const { article, purge } = await unpublishArticle(db, publishActor(event, auth.user.id), await getArticle(db, id), locale)
    await purgeAfterWrite(event, purge)
    return article
  },
})
