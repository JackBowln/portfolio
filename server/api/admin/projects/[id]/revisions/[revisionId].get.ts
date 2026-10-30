// One revision with its snapshot, for the diff the admin computes in the browser (F07-T1)
import { z } from 'zod'
import { getProject, getProjectRevision } from '../../../../../services/content/projects.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64), revisionId: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['read'] },
  handler: async (event) => {
    const { id, revisionId } = getValidatedParamsStrict(event, paramsSchema)
    const db = useDb(event)
    return getProjectRevision(db, await getProject(db, id), revisionId)
  },
})
