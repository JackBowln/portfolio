// A page's pt-BR history, newest first (F08-T2)
import { z } from 'zod'
import { PAGE_KEYS } from '#shared/types/enums'
import { getPage, listPageRevisions } from '../../../../../services/content/pages.service.ts'

const paramsSchema = z.object({ key: z.enum(PAGE_KEYS) })

export default defineAdminHandler({
  permission: { page: ['read'] },
  handler: async (event) => {
    const { key } = getValidatedParamsStrict(event, paramsSchema)
    const db = useDb(event)
    return { items: await listPageRevisions(db, await getPage(db, key)) }
  },
})
