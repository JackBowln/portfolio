// Estimates an AI translation (F09-T3): tokens, neurons and the balance; records an `estimated` job to confirm
import { z } from 'zod'
import { TARGET_LOCALES } from '#shared/translation/glossary'
import { providerFor } from '../../../services/translation/provider.ts'
import { estimateTranslation } from '../../../services/translation/run.service.ts'

const bodySchema = z.object({
  // `texts`: a batch of short texts (F09-T5), entity id `batch`, with the chosen fields as segmentIds
  entityType: z.enum(['article', 'project', 'page', 'texts']),
  entityId: z.string().min(1).max(64),
  locale: z.enum(TARGET_LOCALES),
  // F09-T4: retranslate only these segments of an existing translation
  segmentIds: z.array(z.string().min(1).max(200)).min(1).max(2000).optional(),
})

export default defineAdminHandler({
  permission: { translation: ['run'] },
  handler: async (event, auth) => {
    const input = await readValidatedBodyStrict(event, bodySchema)
    const job = await estimateTranslation(useDb(event), { provider: providerFor(useEnv(event)) }, auth.user.id, input)
    await auditRequest(event, { action: 'translation.estimated', entityType: input.entityType, entityId: input.entityId, metadata: { job: job.id, locale: input.locale, neurons: job.estimate.neurons } })
    return job
  },
})
