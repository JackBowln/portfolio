// Runs or resumes an AI translation job (F09-T3): only with `confirm: true` on a fresh estimate; the cost guard runs
// before every batch. Each call does up to 20 batches; the admin calls again while the job is `running`
import { z } from 'zod'
import { providerFor } from '../../../services/translation/provider.ts'
import { runTranslation } from '../../../services/translation/run.service.ts'

const bodySchema = z.object({ jobId: z.string().min(1).max(64), confirm: z.literal(true) })

export default defineAdminHandler({
  permission: { translation: ['run'] },
  handler: async (event) => {
    const { jobId } = await readValidatedBodyStrict(event, bodySchema)
    const job = await runTranslation(useDb(event), { provider: providerFor(useEnv(event)) }, jobId)
    if (job.status === 'succeeded' || job.status === 'failed') {
      await auditRequest(event, {
        action: job.status === 'succeeded' ? 'translation.completed' : 'translation.failed',
        entityType: job.entityType,
        entityId: job.entityId,
        metadata: { job: job.id, locale: job.locale, neurons: job.usage.neurons, failedSegments: job.failedSegments.length },
      })
    }
    return job
  },
})
