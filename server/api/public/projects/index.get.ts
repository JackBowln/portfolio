// The projects of a locale (F07-T2): public and cached, tagged list:projects:{l}; ?tech= narrows to a technology
// (and adds its tag), and an unknown or empty technology is 404
import { z } from 'zod'
import { parseTechnology } from '#shared/content/projects-public'
import { LOCALES } from '#shared/types/enums'
import { projectList } from '../../../services/content/projects-public.service.ts'

const querySchema = z.object({ locale: z.enum(LOCALES), tech: z.string().max(100).optional() })

export default defineEventHandler(async (event) => {
  const { locale, tech: raw } = getValidatedQueryStrict(event, querySchema)
  const tech = parseTechnology(raw)
  const list = tech === null ? null : await projectList(useDb(event), locale, tech)
  if (!list) {
    throw createAppError('not_found')
  }
  cachePublicly(event, list.cacheTags)
  return list
})
