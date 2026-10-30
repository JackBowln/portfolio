// Soft delete (F07-T1): 409 while a localization is published; an author deletes only their own drafts
import { z } from 'zod'
import { SOURCE_LOCALE } from '#shared/types/enums'
import { deleteProject, getProject } from '../../../../services/content/projects.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['delete'] },
  handler: async (event, auth) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const db = useDb(event)
    const project = await getProject(db, id)
    const status = project.localizations.find(item => item.locale === SOURCE_LOCALE)?.status ?? 'draft'
    assertOwnership(event, { project: ['delete'] }, { authorId: project.authorId, status })
    await deleteProject(db, auth.user.id, project)
    await auditRequest(event, { action: 'project.deleted', entityType: 'project', entityId: id })
    return { ok: true }
  },
})
