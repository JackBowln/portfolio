// A project published in a locale (F07-T2): public and cached with the project's tags; 404 when it is not published
// there
import { z } from 'zod'
import { slugField } from '#shared/content/article-input'
import { cacheTags as tagsOf } from '#shared/cache/tags'
import { LOCALES } from '#shared/types/enums'
import { publicProject } from '../../../services/content/projects-public.service.ts'

import { projectJsonLd } from '../../../services/seo/jsonld.service.ts'
import { siteName } from '../../../services/settings/settings.service.ts'

const paramsSchema = z.object({ slug: slugField })
const querySchema = z.object({ locale: z.enum(LOCALES) })

export default defineEventHandler(async (event) => {
  const params = paramsSchema.safeParse(getRouterParams(event, { decode: true }))
  const { locale } = getValidatedQueryStrict(event, querySchema)
  const project = params.success ? await publicProject(useDb(event), locale, params.data.slug) : null
  if (!project) {
    throw createAppError('not_found')
  }
  // F11-T1: the JSON-LD, with the site's name in the breadcrumbs (a settings change purges it)
  project.jsonLd = projectJsonLd(seoContext(event), project, await siteName(useDb(event)))
  project.cacheTags = [...new Set([...project.cacheTags, tagsOf.settings()])]
  cachePublicly(event, project.cacheTags)
  return project
})
