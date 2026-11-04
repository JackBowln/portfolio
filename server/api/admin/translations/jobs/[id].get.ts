// One translation job (F09-T3): progress, estimate, usage and the sanitized error
import { z } from 'zod'
import { getTranslationJob } from '../../../../services/translation/run.service.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { translation: ['review'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    return getTranslationJob(useDb(event), id)
  },
})
