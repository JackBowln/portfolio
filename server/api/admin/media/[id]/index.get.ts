// One media item with its per-locale metadata, subtitle tracks and where it is used
import { z } from 'zod'
import { getMediaDetail } from '../../../../services/media/media.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { media: ['read'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    return getMediaDetail(useDb(event), id)
  },
})
