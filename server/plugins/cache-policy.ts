// Server-side cache defaults (ADR-0003 §2): every response leaves with an explicit Cache-Control.
// Routes may set their own policy and tags first; this plugin fills the gaps and enforces the invariants:
// errors are never stored, and a publicly cacheable response never carries Set-Cookie.
import { cacheTags } from '#shared/cache/tags'

const CACHEABLE_METHODS = new Set(['GET', 'HEAD'])
// Previews (F06-T3) show drafts: never public, so never tagged nor stored
const NEVER_PUBLIC_PREFIXES = ['/api/', '/admin', '/__nuxt_error', '/preview/']
// @nuxtjs/i18n messages are prerendered static assets; the Worker only sees unknown hashes, answered with the
// current messages and cached at the edge like a page so they cannot pile up Worker invocations
const I18N_MESSAGES_PREFIX = '/_i18n/'

function isPublicPage(path: string): boolean {
  return !NEVER_PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix))
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    const path = event.path.split('?')[0] ?? event.path
    const status = getResponseStatus(event)

    if (status >= 400 || (!isPublicPage(path) && !getResponseHeader(event, 'cache-control'))) {
      setCachePolicy(event, 'none')
      return
    }

    if (path.startsWith(I18N_MESSAGES_PREFIX)) {
      setCachePolicy(event, 'public')
      setCacheTags(event, [cacheTags.i18n()])
    }

    if (!getResponseHeader(event, 'cache-control')) {
      const isHtml = String(getResponseHeader(event, 'content-type') ?? '').startsWith('text/html')
      setCachePolicy(event, CACHEABLE_METHODS.has(event.method) && isHtml ? 'public' : 'none')
    }

    if (!String(getResponseHeader(event, 'cache-control')).includes('public')) {
      return
    }
    if (getResponseHeader(event, 'set-cookie')) {
      logger.error('cache.public_set_cookie_stripped', { requestId: event.context.requestId, route: path })
      removeResponseHeader(event, 'set-cookie')
    }
    if (!getResponseHeader(event, 'cache-tag')) {
      setCacheTags(event, [cacheTags.site()])
    }
  })
})
