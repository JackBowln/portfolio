// Approves a translation (F09-T4): translation:approve; every block translated; publishing is a separate step
import { z } from 'zod'
import { approveTranslation } from '../../../../../../../services/translation/review.service.ts'
import { reviewParamsSchema } from '#shared/translation/review'

const bodySchema = z.object({ version: z.int().min(1) })

export default defineAdminHandler({
  permission: { translation: ['approve'] },
  handler: async (event, auth) => {
    const { type, id, locale } = getValidatedParamsStrict(event, reviewParamsSchema)
    const { version } = await readValidatedBodyStrict(event, bodySchema)
    const review = await approveTranslation(useDb(event), auth.user.id, type, id, locale, version)
    await auditRequest(event, { action: 'translation.approved', entityType: type, entityId: id, metadata: { locale } })
    return review
  },
})
