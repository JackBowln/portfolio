// The pt-BR history of a project, newest first (F07-T1); snapshots are read one at a time
import { z } from 'zod'
import { getProject, listProjectRevisions } from '../../../../../services/content/projects.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['read'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const db = useDb(event)
    return { items: await listProjectRevisions(db, await getProject(db, id)) }
  },
})
