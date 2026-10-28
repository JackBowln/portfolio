// Baseline headers for every Worker response (ADR-0012 §1); the CSP lives in ./csp.ts. Static assets never reach
// the Worker: they get nosniff from routeRules, which Nitro writes to _headers
const BASE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
  'x-frame-options': 'DENY',
} as const

// Only on the production domain: a preview workers.dev subdomain must not pin HSTS for the whole zone
const HSTS = 'max-age=63072000; includeSubDomains'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    setResponseHeaders(event, BASE_HEADERS)
    if (event.context.cloudflare?.env.ENVIRONMENT === 'production') {
      setResponseHeader(event, 'strict-transport-security', HSTS)
    }
  })

  nitroApp.hooks.hook('beforeResponse', (event) => {
    removeResponseHeader(event, 'x-powered-by')
  })
})
