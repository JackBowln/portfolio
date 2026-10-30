// A new draft from its title alone, at the end of the order, with the case-study sections as its body (F07-T1)
import { projectCreateSchema } from '#shared/content/project-input'
import { createProject } from '../../../services/content/projects.service.ts'

export default defineAdminHandler({
  permission: { project: ['create'] },
  handler: async (event, auth) => {
    const { title } = await readValidatedBodyStrict(event, projectCreateSchema)
    const project = await createProject(useDb(event), auth.user.id, title)
    await auditRequest(event, { action: 'project.created', entityType: 'project', entityId: project.id })
    setResponseStatus(event, 201)
    return project
  },
})
