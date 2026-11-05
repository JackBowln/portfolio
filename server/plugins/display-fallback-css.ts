// F11-T5: the narrower Fraunces fallbacks of display titles (shared/design/fonts.ts), in the server-rendered <head>
// only. The client never needs them again: they stay in the document, and app.head would put them in the JS bundle
import { DISPLAY_FALLBACK_CSS } from '#shared/design/fonts'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    html.head.push(`<style>${DISPLAY_FALLBACK_CSS}</style>`)
  })
})
