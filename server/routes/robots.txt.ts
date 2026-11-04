// ADR-0008 §6: the rules per environment are in shared/seo/robots.ts; outside production,
// server/plugins/robots-header.ts also adds X-Robots-Tag to every response
import { cacheTags } from '#shared/cache/tags'
import { robotsTxt } from '#shared/seo/robots'

export default defineEventHandler((event) => {
  const env = useEnv(event)
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setCachePolicy(event, 'public')
  setCacheTags(event, [cacheTags.robots()])
  return robotsTxt(env.ENVIRONMENT, env.SITE_URL)
})
