// Renames a topic or technology or changes its slug; it changes every article or project that uses it, so it needs
// tag:update (F06-T1); then the pages that show it are purged (F11-T4)
import { z } from 'zod'
import { tagPurgeTags } from '#shared/cache/purge'
import { tagUpdateSchema } from '#shared/content/article-input'
import { renameTag } from '../../../../services/content/tags.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { tag: ['update'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, tagUpdateSchema)
    const { kind, ...tag } = await renameTag(useDb(event), auth.user.id, id, input)
    await auditRequest(event, { action: 'tag.updated', entityType: 'tag', entityId: id, metadata: { kind, fields: Object.keys(input).join(',') } })
    await purgeAfterWrite(event, tagPurgeTags(id))
    return tag
  },
})
