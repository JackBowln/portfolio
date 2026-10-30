// Redirects of old article paths (data-model §9.4, ADR-0003 §3, F06-T4): a published slug that changed leaves a
// 301 from the old path. Only GET/HEAD on paths shaped like an article reach D1; the answer is cached at the edge
// with the `redirects` tag, which every redirect change purges
import { ARTICLE_PATH } from '#shared/content/paths'
import { cacheTags } from '#shared/cache/tags'
import { findRedirect } from '../services/content/publishing.repo.ts'

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    return
  }
  const path = event.path.split('?')[0] ?? event.path
  if (!ARTICLE_PATH.test(path)) {
    return
  }
  const redirect = await findRedirect(useDb(event), path)
  if (!redirect) {
    return
  }
  setCachePolicy(event, 'public')
  setCacheTags(event, [cacheTags.redirects()])
  return sendRedirect(event, redirect.toPath, redirect.statusCode)
})
