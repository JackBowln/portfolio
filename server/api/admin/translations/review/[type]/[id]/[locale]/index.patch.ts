// Saves a reviewer's texts (F09-T4): tags checked against the source per segment; the translation goes to review
import { z } from 'zod'
import { saveReview } from '../../../../../../../services/translation/review.service.ts'
import { reviewParamsSchema } from '#shared/translation/review'

const bodySchema = z.object({
  version: z.int().min(0),
  segments: z.record(z.string().max(200), z.string().max(20_000)).refine(segments => Object.keys(segments).length <= 2000, 'too_many'),
  slug: z.string().trim().min(1).max(120).optional(),
})

export default defineAdminHandler({
  permission: { translation: ['review'] },
  handler: async (event, auth) => {
    const { type, id, locale } = getValidatedParamsStrict(event, reviewParamsSchema)
    const input = await readValidatedBodyStrict(event, bodySchema)
    const review = await saveReview(useDb(event), auth.user.id, type, id, locale, input)
    await auditRequest(event, { action: 'translation.reviewed', entityType: type, entityId: id, metadata: { locale, segments: Object.keys(input.segments).length } })
    return review
  },
})
