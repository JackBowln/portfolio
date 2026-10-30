// One project with its working copies, for the editor (F07-T1)
import { z } from 'zod'
import { getProject } from '../../../../services/content/projects.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { project: ['read'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    return getProject(useDb(event), id)
  },
})
