// A new topic; the slug comes from the name unless given (F06-T1)
import { tagCreateSchema } from '#shared/content/article-input'
import { createTopic } from '../../../services/content/tags.service.ts'

export default defineAdminHandler({
  permission: { tag: ['create'] },
  handler: async (event, auth) => {
    const input = await readValidatedBodyStrict(event, tagCreateSchema)
    const tag = await createTopic(useDb(event), auth.user.id, input)
    await auditRequest(event, { action: 'tag.created', entityType: 'tag', entityId: tag.id })
    setResponseStatus(event, 201)
    return tag
  },
})
