// Back to an older pt-BR revision (F07-T1, RF-05.6): the working copy takes its content and a `restore` revision is
// recorded; no revision is deleted. An author restores only their own projects
import { z } from 'zod'
import { articleRestoreSchema } from '#shared/content/article-input'
import { getProject, restoreProjectRevision } from '../../../../services/content/projects.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['restore'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, articleRestoreSchema)
    const db = useDb(event)
    const project = await getProject(db, id)
    assertOwnership(event, { project: ['restore'] }, { authorId: project.authorId })
    const { project: restored, restored: number } = await restoreProjectRevision(db, auth.user.id, project, input)
    await auditRequest(event, { action: 'project.restored', entityType: 'project', entityId: id, metadata: { revision: number } })
    return restored
  },
})
