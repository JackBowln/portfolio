// Marks the item ready once every expected file is in R2 with its declared size; 409 lists what is missing.
// The successful uploads are summarized here instead of one audit entry each
import { z } from 'zod'
import { finalizeMedia } from '../../../../services/media/media.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { media: ['create'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const result = await finalizeMedia(useDb(event), useEnv(event).MEDIA, auth.user.id, id)
    await auditRequest(event, { action: 'media.finalized', entityType: 'media', entityId: id, metadata: { uploads: result.uploads, bytes: result.bytes } })
    return result
  },
})
