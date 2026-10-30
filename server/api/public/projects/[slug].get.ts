// A project published in a locale (F07-T2): public and cached with the project's tags; 404 when it is not published
// there
import { z } from 'zod'
import { slugField } from '#shared/content/article-input'
import { LOCALES } from '#shared/types/enums'
import { publicProject } from '../../../services/content/projects-public.service.ts'

const paramsSchema = z.object({ slug: slugField })
const querySchema = z.object({ locale: z.enum(LOCALES) })

export default defineEventHandler(async (event) => {
  const params = paramsSchema.safeParse(getRouterParams(event, { decode: true }))
  const { locale } = getValidatedQueryStrict(event, querySchema)
  const project = params.success ? await publicProject(useDb(event), locale, params.data.slug) : null
  if (!project) {
    throw createAppError('not_found')
  }
  cachePublicly(event, project.cacheTags)
  return project
})
