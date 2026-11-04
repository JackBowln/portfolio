// An institutional page in a locale (F08-T2): the published blocks of the locale, else of pt-BR (fallback, shown with
// a notice and noindex), else an empty state; public and cached, tagged page:{key}:{l}
import { z } from 'zod'
import { LOCALES, PAGE_KEYS } from '#shared/types/enums'
import { cacheTags as tagsOf } from '#shared/cache/tags'
import { publicPage } from '../../../services/content/pages.service.ts'
import { aboutJsonLd, homeJsonLd } from '../../../services/seo/jsonld.service.ts'
import { publicSettings } from '../../../services/settings/settings.service.ts'

const paramsSchema = z.object({ key: z.enum(PAGE_KEYS) })
const querySchema = z.object({ locale: z.enum(LOCALES) })

export default defineEventHandler(async (event) => {
  const { key } = getValidatedParamsStrict(event, paramsSchema)
  const { locale } = getValidatedQueryStrict(event, querySchema)
  const db = useDb(event)
  const page = await publicPage(db, key, locale)
  // F11-T1: the home and the about page describe the owner. The home always does (even empty, it shows the site's
  // name); the about page only once something is published
  if (key === 'home' || (key === 'about' && !page.empty)) {
    const context = seoContext(event)
    const settings = await publicSettings(db, locale, context.mediaBaseUrl)
    page.jsonLd = key === 'home' ? homeJsonLd(context, locale, settings) : aboutJsonLd(context, locale, settings, page.publishedAt)
    page.cacheTags = [...new Set([...page.cacheTags, tagsOf.settings()])]
  }
  cachePublicly(event, page.cacheTags)
  return page
})
