// Content-Security-Policy (ADR-0012 §1): pages get hashes of the inline scripts in their final HTML; every other
// Worker response gets a policy that loads nothing. Off in `nuxt dev`, whose Vite client injects its own scripts
import type { H3Event } from 'h3'

async function policyForPage(event: H3Event, html: string): Promise<string> {
  const env = event.context.cloudflare?.env as Env | undefined
  // Nuxt renders error pages in an internal sub-request that has no bindings (its headers are copied to the real
  // response); the public site URL holds the same value, and an error page shows no media
  const siteUrl = env?.SITE_URL ?? useRuntimeConfig(event).public.siteUrl
  return pageCsp({
    scriptHashes: [...await Promise.all(inlineScripts(html).map(scriptHash)), ...CLIENT_ONLY_SCRIPT_HASHES],
    mediaOrigin: mediaOriginFor(siteUrl, env?.MEDIA_BASE_URL),
    upgradeInsecureRequests: siteUrl.startsWith('https://'),
  })
}

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) {
    return
  }

  nitroApp.hooks.hook('request', (event) => {
    setResponseHeader(event, 'content-security-policy', NON_PAGE_CSP)
  })

  // Runs on the rendered body before it is sent, so the header and the HTML are cached together
  nitroApp.hooks.hook('render:response', async (response, { event }) => {
    const contentType = String(response.headers?.['content-type'] ?? '')
    if (typeof response.body !== 'string' || !contentType.startsWith('text/html')) {
      return
    }
    response.headers = { ...response.headers, 'content-security-policy': await policyForPage(event, response.body) }
  })
})
