// Saves a reviewer's short texts (F09-T5): each item goes to review; settings texts also need settings:update
import { z } from 'zod'
import { can } from '#shared/auth/permissions'
import { TARGET_LOCALES } from '#shared/translation/glossary'
import { saveTextItems } from '../../../../services/translation/texts.service.ts'

const bodySchema = z.object({
  locale: z.enum(TARGET_LOCALES),
  items: z.array(z.strictObject({
    key: z.string().min(1).max(100),
    fields: z.record(z.string().max(40), z.string().trim().min(1, 'required').max(2000)),
    slug: z.string().trim().min(1).max(120).optional(),
  })).min(1).max(200),
})

export default defineAdminHandler({
  permission: { translation: ['review'] },
  handler: async (event, auth) => {
    const { locale, items } = await readValidatedBodyStrict(event, bodySchema)
    const result = await saveTextItems(useDb(event), locale, items, can(auth.user.role, { settings: ['update'] }))
    await auditRequest(event, { action: 'translation.reviewed', entityType: 'texts', entityId: 'batch', metadata: { locale, items: items.map(item => item.key).join(',').slice(0, 500) } })
    return { items: result }
  },
})
