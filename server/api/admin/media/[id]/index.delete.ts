// Soft delete (ADR-0007 §8): 409 with the list of uses while anything uses the media. An author deletes only
// what they uploaded; the cron removes the R2 objects 30 days later (F06)
import { z } from 'zod'
import { deleteMedia, findMediaForDelete } from '../../../../services/media/media.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { media: ['delete'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const db = useDb(event)
    const media = await findMediaForDelete(db, id)
    assertOwnership(event, { media: ['delete'] }, { authorId: media.createdBy })
    await deleteMedia(db, auth.user.id, id)
    await auditRequest(event, { action: 'media.deleted', entityType: 'media', entityId: id })
    return { ok: true }
  },
})
