// Approves short texts in batch (F09-T5): translation:approve, and settings:update for settings texts; then the purge
import { z } from 'zod'
import { can } from '#shared/auth/permissions'
import { TARGET_LOCALES } from '#shared/translation/glossary'
import { approveTextItems } from '../../../../services/translation/texts.service.ts'

const bodySchema = z.object({ locale: z.enum(TARGET_LOCALES), keys: z.array(z.string().min(1).max(100)).min(1).max(200) })

export default defineAdminHandler({
  permission: { translation: ['approve'] },
  handler: async (event, auth) => {
    const { locale, keys } = await readValidatedBodyStrict(event, bodySchema)
    const { items, purge } = await approveTextItems(useDb(event), locale, keys, can(auth.user.role, { settings: ['update'] }))
    await auditRequest(event, { action: 'translation.approved', entityType: 'texts', entityId: 'batch', metadata: { locale, items: keys.join(',').slice(0, 500) } })
    await purgeAfterWrite(event, purge)
    return { items }
  },
})
