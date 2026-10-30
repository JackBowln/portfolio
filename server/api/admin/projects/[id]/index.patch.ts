// Saves the pt-BR working copy and the project's fields (F07-T1) as the editor's autosave: each save records an
// autosave revision, dropped when it repeats the latest. 409 on "version" when the copy changed since the editor
// read it, on "slug" when the slug is taken. An author edits only the projects they created
import { z } from 'zod'
import { projectUpdateSchema } from '#shared/content/project-input'
import { getProject, updateProject } from '../../../../services/content/projects.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['update'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const input = await readValidatedBodyStrict(event, projectUpdateSchema)
    const db = useDb(event)
    const project = await getProject(db, id)
    assertOwnership(event, { project: ['update'] }, { authorId: project.authorId })
    return updateProject(db, auth.user.id, project, input)
  },
})
