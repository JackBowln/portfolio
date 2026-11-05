// F11-T4 (ADR-0003 decision 3): a public page with a query parameter it does not read answers a cached 301 to the URL
// without it, so `?utm_source=…` costs one cheap redirect instead of a new cache entry and a full SSR
import { cacheTags } from '#shared/cache/tags'
import { canonicalQueryTarget } from '#shared/seo/canonical-query'

export default defineEventHandler((event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    return
  }
  const index = event.path.indexOf('?')
  if (index === -1) {
    return
  }
  const target = canonicalQueryTarget(event.path.slice(0, index), event.path.slice(index))
  if (!target) {
    return
  }
  setCachePolicy(event, 'public')
  // Sent before beforeResponse, so its tag is set here
  setCacheTags(event, [cacheTags.site()])
  return sendRedirect(event, target, 301)
})
