// One revision of a page with its snapshot, for the comparison in the admin (F08-T2)
import { z } from 'zod'
import { PAGE_KEYS } from '#shared/types/enums'
import { getPage, getPageRevision } from '../../../../../services/content/pages.service.ts'

const paramsSchema = z.object({ key: z.enum(PAGE_KEYS), revisionId: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { page: ['read'] },
  handler: async (event) => {
    const { key, revisionId } = getValidatedParamsStrict(event, paramsSchema)
    const db = useDb(event)
    return getPageRevision(db, await getPage(db, key), revisionId)
  },
})
