// Renames a topic or changes its slug; it changes every article that uses it, so it needs tag:update (F06-T1)
import { z } from 'zod'
import { tagUpdateSchema } from '#shared/content/article-input'
import { updateTopic } from '../../../../services/content/tags.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { tag: ['update'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, tagUpdateSchema)
    const tag = await updateTopic(useDb(event), auth.user.id, id, input)
    await auditRequest(event, { action: 'tag.updated', entityType: 'tag', entityId: id, metadata: { fields: Object.keys(input).join(',') } })
    return tag
  },
})
