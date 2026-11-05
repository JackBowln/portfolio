// Purges every public response but the content-addressed media files (F11-T4, ADR-0003, ADR-0014): the step after a
// deploy, since each version's assets leave with it. settings:update (owner and admin), audited
import { sitePurgeTags } from '#shared/cache/purge'

export default defineAdminHandler({
  permission: { settings: ['update'] },
  handler: async (event) => {
    const tags = sitePurgeTags()
    await purgeCacheTags(event, tags)
    await auditRequest(event, { action: 'cache.purged', metadata: { tags: tags.join(',') } })
    return { purged: tags }
  },
})
