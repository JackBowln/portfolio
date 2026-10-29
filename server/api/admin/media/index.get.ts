// Media library list: filters by kind, status, file name and missing alt, newest first, one page at a time
import { z } from 'zod'
import { MEDIA_KINDS } from '#shared/types/enums'
import { queryMedia } from '../../../services/media/media.service.ts'

const querySchema = z.object({
  kind: z.enum(MEDIA_KINDS).optional(),
  status: z.enum(['pending', 'ready']).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  missingAlt: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export default defineAdminHandler({
  permission: { media: ['read'] },
  handler: async (event) => {
    const { q, ...query } = getValidatedQueryStrict(event, querySchema)
    return queryMedia(useDb(event), { ...query, search: q })
  },
})
