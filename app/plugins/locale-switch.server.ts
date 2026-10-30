// Rewrites the language switcher's links once the page has rendered (see useLocaleSwitchHref): the footer renders
// before the page's async setup sets its i18n params and fallback, as @nuxtjs/i18n does for SwitchLocalePathLink
import type { Locale } from '#shared/types/enums'

const LINK = /<a\b[^>]*\bdata-locale-switch="([\w-]+)"[^>]*>/g
const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export default defineNuxtPlugin({
  name: 'locale-switch',
  dependsOn: ['i18n:plugin'],
  setup(nuxtApp) {
    const router = useRouter()
    const href = useLocaleSwitchHref(() => router.currentRoute.value.path)
    nuxtApp.hook('app:rendered', (context) => {
      if (context.renderResult?.html == null) {
        return
      }
      context.renderResult.html = context.renderResult.html.replace(LINK, (tag, locale: string) =>
        tag.replace(/\bhref="[^"]*"/, `href="${escapeAttr(href(locale as Locale))}"`))
    })
  },
})
