// Takes a page off the site (F08-T2); pt-BR takes its published translations with it. Revisions stay
import { z } from 'zod'
import { articleLocaleSchema } from '#shared/content/article-input'
import { PAGE_KEYS } from '#shared/types/enums'
import { getPage, unpublishPage } from '../../../../services/content/pages.service.ts'

const paramsSchema = z.object({ key: z.enum(PAGE_KEYS) })

export default defineAdminHandler({
  permission: { page: ['publish'] },
  handler: async (event, auth) => {
    const { key } = getValidatedParamsStrict(event, paramsSchema)
    const { locale } = await readValidatedBodyStrict(event, articleLocaleSchema)
    const db = useDb(event)
    const { page, purge } = await unpublishPage(db, publishActor(event, auth.user.id), await getPage(db, key), locale)
    await purgeAfterWrite(event, purge)
    return page
  },
})
