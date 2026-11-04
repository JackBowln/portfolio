// An article published in a locale (F06-T5): public and cached with the article's tags; 404 when it is not
// published there (an article only in pt-BR has no /en page)
import { z } from 'zod'
import { slugField } from '#shared/content/article-input'
import { cacheTags as tagsOf } from '#shared/cache/tags'
import { LOCALES } from '#shared/types/enums'
import { blogArticle } from '../../../services/content/blog.service.ts'

import { articleJsonLd } from '../../../services/seo/jsonld.service.ts'
import { siteName } from '../../../services/settings/settings.service.ts'

const paramsSchema = z.object({ slug: slugField })
const querySchema = z.object({ locale: z.enum(LOCALES) })

export default defineEventHandler(async (event) => {
  const params = paramsSchema.safeParse(getRouterParams(event, { decode: true }))
  const { locale } = getValidatedQueryStrict(event, querySchema)
  const article = params.success ? await blogArticle(useDb(event), locale, params.data.slug, seoContext(event).mediaBaseUrl) : null
  if (!article) {
    throw createAppError('not_found')
  }
  // F11-T1: the JSON-LD, with the site's name in the breadcrumbs (a settings change purges it)
  article.jsonLd = articleJsonLd(seoContext(event), article, await siteName(useDb(event)))
  article.cacheTags = [...new Set([...article.cacheTags, tagsOf.settings()])]
  cachePublicly(event, article.cacheTags)
  return article
})
