// A named version of a page's working copy (F08-T2); 409 on "version" when the copy changed since it was read
import { z } from 'zod'
import { articleVersionSchema } from '#shared/content/article-input'
import { PAGE_KEYS } from '#shared/types/enums'
import { getPage, savePageVersion } from '../../../../../services/content/pages.service.ts'

const paramsSchema = z.object({ key: z.enum(PAGE_KEYS) })

export default defineAdminHandler({
  permission: { page: ['update'] },
  handler: async (event, auth) => {
    const { key } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, articleVersionSchema)
    assertOwnership(event, { page: ['update'] }, { authorId: null })
    const db = useDb(event)
    const result = await savePageVersion(db, auth.user.id, await getPage(db, key), { version: input.version, note: input.note ?? null })
    if (result.created) {
      await auditRequest(event, { action: 'page.version_saved', entityType: 'page', entityId: key, metadata: { revision: result.revision.number } })
      setResponseStatus(event, 201)
    }
    return result.revision
  },
})
