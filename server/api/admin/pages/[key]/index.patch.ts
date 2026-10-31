// Saves a page's pt-BR working copy (F08-T2) as the editor's autosave: blocks by the page's own schema and the SEO
// fields, with the version read (409 when it changed). Pages have no author, so the `own` scope of authors never
// covers them: editors and up save
import { z } from 'zod'
import { pageUpdateSchema } from '#shared/pages/input'
import type { PageUpdate } from '#shared/pages/input'
import { PAGE_KEYS } from '#shared/types/enums'
import { getPage, updatePage } from '../../../../services/content/pages.service.ts'

const paramsSchema = z.object({ key: z.enum(PAGE_KEYS) })

export default defineAdminHandler({
  permission: { page: ['update'] },
  handler: async (event, auth) => {
    const { key } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, pageUpdateSchema(key)) as PageUpdate
    assertOwnership(event, { page: ['update'] }, { authorId: null })
    const db = useDb(event)
    return updatePage(db, auth.user.id, await getPage(db, key), input)
  },
})
