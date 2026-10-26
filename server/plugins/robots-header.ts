// ADR-0008 §6: nothing outside production is indexable, whatever the page says
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (event.context.cloudflare?.env.ENVIRONMENT !== 'production') {
      setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
    }
  })
})
