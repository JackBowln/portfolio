// The site and media origins JSON-LD needs (F11-T1), from the Worker's environment
import type { H3Event } from 'h3'
import type { SeoContext } from '../services/seo/jsonld.service.ts'

export function seoContext(event: H3Event): SeoContext {
  const env = useEnv(event)
  return { siteUrl: env.SITE_URL, mediaBaseUrl: env.MEDIA_BASE_URL ?? env.SITE_URL }
}
