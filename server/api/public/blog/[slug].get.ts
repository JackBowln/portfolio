// An article published in a locale (F06-T5): public and cached with the article's tags; 404 when it is not
// published there (an article only in pt-BR has no /en page)
import { z } from 'zod'
import { slugField } from '#shared/content/article-input'
import { LOCALES } from '#shared/types/enums'
import { blogArticle } from '../../../services/content/blog.service.ts'

const paramsSchema = z.object({ slug: slugField })
const querySchema = z.object({ locale: z.enum(LOCALES) })

export default defineEventHandler(async (event) => {
  const params = paramsSchema.safeParse(getRouterParams(event, { decode: true }))
  const { locale } = getValidatedQueryStrict(event, querySchema)
  const article = params.success ? await blogArticle(useDb(event), locale, params.data.slug) : null
  if (!article) {
    throw createAppError('not_found')
  }
  cachePublicly(event, article.cacheTags)
  return article
})
