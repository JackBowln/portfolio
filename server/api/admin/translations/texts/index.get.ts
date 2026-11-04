// Short texts to translate in one locale (F09-T5): topic names, media texts and the localized settings
import { z } from 'zod'
import { TARGET_LOCALES } from '#shared/translation/glossary'
import { listTextItems } from '../../../../services/translation/texts.service.ts'

const querySchema = z.object({ locale: z.enum(TARGET_LOCALES) })

export default defineAdminHandler({
  permission: { translation: ['review'] },
  handler: async (event) => {
    const { locale } = getValidatedQueryStrict(event, querySchema)
    return { items: await listTextItems(useDb(event), locale) }
  },
})
