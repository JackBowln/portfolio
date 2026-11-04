// A topic's articles in a locale (F06-T5): 404 when the topic has no name or no published article there
import { z } from 'zod'
import { slugField } from '#shared/content/article-input'
import { parsePage } from '#shared/content/blog'
import { cacheTags as tagsOf } from '#shared/cache/tags'
import { LOCALES } from '#shared/types/enums'
import { topicPage } from '../../../../services/content/blog.service.ts'
import { blogListJsonLd } from '../../../../services/seo/jsonld.service.ts'
import { siteName } from '../../../../services/settings/settings.service.ts'

const paramsSchema = z.object({ slug: slugField })
const querySchema = z.object({ locale: z.enum(LOCALES), page: z.string().max(7).optional() })

export default defineEventHandler(async (event) => {
  const params = paramsSchema.safeParse(getRouterParams(event, { decode: true }))
  const { locale, page: raw } = getValidatedQueryStrict(event, querySchema)
  const page = parsePage(raw)
  const topic = params.success && page !== null ? await topicPage(useDb(event), locale, params.data.slug, page) : null
  if (!topic) {
    throw createAppError('not_found')
  }
  // F11-T1: CollectionPage and breadcrumbs
  topic.jsonLd = blogListJsonLd(seoContext(event), locale, await siteName(useDb(event)), page!, topic.topic)
  topic.cacheTags = [...new Set([...topic.cacheTags, tagsOf.settings()])]
  cachePublicly(event, topic.cacheTags)
  return topic
})
