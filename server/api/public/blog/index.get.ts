// One page of the blog in a locale (F06-T5): public and cached, tagged list:blog:{l}; a page past the last is 404
import { z } from 'zod'
import { parsePage } from '#shared/content/blog'
import { cacheTags as tagsOf } from '#shared/cache/tags'
import { LOCALES } from '#shared/types/enums'
import { blogPage } from '../../../services/content/blog.service.ts'
import { blogListJsonLd } from '../../../services/seo/jsonld.service.ts'
import { siteName } from '../../../services/settings/settings.service.ts'

const querySchema = z.object({ locale: z.enum(LOCALES), page: z.string().max(7).optional() })

export default defineEventHandler(async (event) => {
  const { locale, page: raw } = getValidatedQueryStrict(event, querySchema)
  const page = parsePage(raw)
  const list = page === null ? null : await blogPage(useDb(event), locale, page)
  if (!list) {
    throw createAppError('not_found')
  }
  // F11-T1: CollectionPage and breadcrumbs
  list.jsonLd = blogListJsonLd(seoContext(event), locale, await siteName(useDb(event)), page!)
  list.cacheTags = [...new Set([...list.cacheTags, tagsOf.settings()])]
  cachePublicly(event, list.cacheTags)
  return list
})
