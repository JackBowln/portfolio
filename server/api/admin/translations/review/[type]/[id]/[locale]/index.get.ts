// One translation under review (F09-T4): segments side by side, their status and the previous text
import { getReview } from '../../../../../../../services/translation/review.service.ts'
import { reviewParamsSchema } from '#shared/translation/review'

export default defineAdminHandler({
  permission: { translation: ['review'] },
  handler: async (event) => {
    const { type, id, locale } = getValidatedParamsStrict(event, reviewParamsSchema)
    return getReview(useDb(event), type, id, locale)
  },
})
