// Publishes a page (F08-T2): one guarded batch, then the purge of the page in every locale when pt-BR changes (the
// fallbacks show it) and of the sitemap
import { z } from 'zod'
import { articlePublishSchema } from '#shared/content/article-input'
import { PAGE_KEYS } from '#shared/types/enums'
import { getPage, publishPage } from '../../../../services/content/pages.service.ts'

const paramsSchema = z.object({ key: z.enum(PAGE_KEYS) })

export default defineAdminHandler({
  permission: { page: ['publish'] },
  handler: async (event, auth) => {
    const { key } = getValidatedParamsStrict(event, paramsSchema)
    const { locale, version } = await readValidatedBodyStrict(event, articlePublishSchema)
    const db = useDb(event)
    const { page, purge } = await publishPage(db, publishActor(event, auth.user.id), await getPage(db, key), locale, version)
    await purgeAfterWrite(event, purge)
    return page
  },
})
