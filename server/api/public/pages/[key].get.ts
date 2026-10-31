// An institutional page in a locale (F08-T2): the published blocks of the locale, else of pt-BR (fallback, shown with
// a notice and noindex), else an empty state; public and cached, tagged page:{key}:{l}
import { z } from 'zod'
import { LOCALES, PAGE_KEYS } from '#shared/types/enums'
import { publicPage } from '../../../services/content/pages.service.ts'

const paramsSchema = z.object({ key: z.enum(PAGE_KEYS) })
const querySchema = z.object({ locale: z.enum(LOCALES) })

export default defineEventHandler(async (event) => {
  const { key } = getValidatedParamsStrict(event, paramsSchema)
  const { locale } = getValidatedQueryStrict(event, querySchema)
  const page = await publicPage(useDb(event), key, locale)
  cachePublicly(event, page.cacheTags)
  return page
})
