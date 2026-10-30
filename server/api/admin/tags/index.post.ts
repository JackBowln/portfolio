// A new topic or technology (kind, F07-T1); the slug comes from the name unless given (F06-T1)
import { tagCreateSchema } from '#shared/content/article-input'
import { createTag } from '../../../services/content/tags.service.ts'

export default defineAdminHandler({
  permission: { tag: ['create'] },
  handler: async (event, auth) => {
    const { kind, ...input } = await readValidatedBodyStrict(event, tagCreateSchema)
    const tag = await createTag(useDb(event), auth.user.id, kind, input)
    await auditRequest(event, { action: 'tag.created', entityType: 'tag', entityId: tag.id, metadata: { kind } })
    setResponseStatus(event, 201)
    return tag
  },
})
