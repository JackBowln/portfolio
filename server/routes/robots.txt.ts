// ADR-0008 §6: production allows everything but the private areas and points to the sitemap; any other environment
// blocks crawling (and server/plugins/robots-header.ts adds X-Robots-Tag to every response)
import { cacheTags } from '#shared/cache/tags'

export default defineEventHandler((event) => {
  const env = useEnv(event)
  const lines = env.ENVIRONMENT === 'production'
    ? ['User-agent: *', 'Disallow: /admin', 'Disallow: /api', 'Disallow: /preview', '', `Sitemap: ${env.SITE_URL.replace(/\/$/, '')}/sitemap.xml`]
    : ['User-agent: *', 'Disallow: /']

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setCachePolicy(event, 'public')
  setCacheTags(event, [cacheTags.robots()])
  return `${lines.join('\n')}\n`
})
