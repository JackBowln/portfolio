// The public settings of a locale (F08-T1): identity, social links, the contact e-mail if shown, SEO defaults,
// navigation, footer and features, resolved with fallbacks; never ai_translation. Cached at the edge, tagged
// `settings`, which every save purges
import { z } from 'zod'
import { LOCALES } from '#shared/types/enums'
import { publicSettings } from '../../services/settings/settings.service.ts'

const querySchema = z.object({ locale: z.enum(LOCALES) })

export default defineEventHandler(async (event) => {
  const { locale } = getValidatedQueryStrict(event, querySchema)
  const settings = await publicSettings(useDb(event), locale, useEnv(event).MEDIA_BASE_URL)
  cachePublicly(event, settings.cacheTags)
  return settings
})
