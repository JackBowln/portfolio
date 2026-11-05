// The manual order of the projects (F07-T1, RF-09.2): every project id, first to last, in one batch. It moves other
// people's projects on the site, so it needs project:publish (editor and up); 409 when the list changed meanwhile.
// The lists and the home read the order live, so they are purged (F11-T4)
import { projectListPurgeTags } from '#shared/cache/purge'
import { projectOrderSchema } from '#shared/content/project-input'
import { listProjects, reorderProjects } from '../../../services/content/projects.service.ts'

export default defineAdminHandler({
  permission: { project: ['publish'] },
  handler: async (event, auth) => {
    const { ids } = await readValidatedBodyStrict(event, projectOrderSchema)
    const db = useDb(event)
    await reorderProjects(db, auth.user.id, ids)
    await auditRequest(event, { action: 'project.reordered', entityType: 'project', metadata: { count: ids.length } })
    await purgeAfterWrite(event, projectListPurgeTags())
    return listProjects(db)
  },
})
