// A named version of the working copy, with an optional note (F07-T1). An author names versions of their own
// projects only; 409 on "version" when the copy changed since the editor read it
import { z } from 'zod'
import { articleVersionSchema } from '#shared/content/article-input'
import { getProject, saveProjectVersion } from '../../../../../services/content/projects.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['update'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, articleVersionSchema)
    const db = useDb(event)
    const project = await getProject(db, id)
    assertOwnership(event, { project: ['update'] }, { authorId: project.authorId })
    const result = await saveProjectVersion(db, auth.user.id, project, { version: input.version, note: input.note ?? null })
    if (result.created) {
      await auditRequest(event, { action: 'project.version_saved', entityType: 'project', entityId: id, metadata: { revision: result.revision.number } })
      setResponseStatus(event, 201)
    }
    return result.revision
  },
})
