// One page with its working copies, for the editor (F08-T2)
import { z } from 'zod'
import { PAGE_KEYS } from '#shared/types/enums'
import { getPage } from '../../../../services/content/pages.service.ts'

const paramsSchema = z.object({ key: z.enum(PAGE_KEYS) })

export default defineAdminHandler({
  permission: { page: ['read'] },
  handler: async (event) => {
    const { key } = getValidatedParamsStrict(event, paramsSchema)
    return getPage(useDb(event), key)
  },
})
