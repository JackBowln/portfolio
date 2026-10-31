// Back to an older revision of a page (F08-T2): a `restore` revision is recorded; nothing is deleted
import { z } from 'zod'
import { articleRestoreSchema } from '#shared/content/article-input'
import { PAGE_KEYS } from '#shared/types/enums'
import { getPage, restorePageRevision } from '../../../../services/content/pages.service.ts'

const paramsSchema = z.object({ key: z.enum(PAGE_KEYS) })

export default defineAdminHandler({
  permission: { page: ['restore'] },
  handler: async (event, auth) => {
    const { key } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, articleRestoreSchema)
    assertOwnership(event, { page: ['restore'] }, { authorId: null })
    const db = useDb(event)
    const { page, restored } = await restorePageRevision(db, auth.user.id, await getPage(db, key), input)
    await auditRequest(event, { action: 'page.restored', entityType: 'page', entityId: key, metadata: { revision: restored } })
    return page
  },
})
