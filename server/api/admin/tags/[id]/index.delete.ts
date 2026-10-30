// Deletes a topic no article uses; 409 with the number of articles otherwise (F06-T1, decision 3)
import { z } from 'zod'
import { deleteTopic } from '../../../../services/content/tags.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { tag: ['delete'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    await deleteTopic(useDb(event), id)
    await auditRequest(event, { action: 'tag.deleted', entityType: 'tag', entityId: id })
    return { ok: true }
  },
})
