// Pages whose equivalent may not exist in every locale (an article published only in pt-BR, a topic) say where it
// exists; the language switcher sends the other locales to `fallback` in that locale (the blog index), never to a
// 404. Keyed by path, so the next page never inherits it
import type { Locale } from '#shared/types/enums'

interface LocaleFallback {
  path: string
  available: readonly Locale[]
  fallback: string
}

const useLocaleFallbackState = () => useState<LocaleFallback | null>('locale-fallback', () => null)

export function useLocaleFallback(available: readonly Locale[], fallback: string): void {
  useLocaleFallbackState().value = { path: useRoute().path, available, fallback }
}

/**
 * The switcher's href for a locale on the page at `path()`. Shared by the switcher and the server plugin that
 * rewrites its links after rendering: the footer renders before the page's async setup has set the fallback
 */
export function useLocaleSwitchHref(path: () => string): (locale: Locale) => string {
  const state = useLocaleFallbackState()
  const switchLocalePath = useSwitchLocalePath()
  const localePath = useLocalePath()
  return (locale) => {
    const fallback = state.value
    // A page with no route (the 404) has no equivalent: the home of that locale (F12-T1), never a link without href
    return fallback && fallback.path === path() && !fallback.available.includes(locale)
      ? localePath(fallback.fallback, locale)
      : switchLocalePath(locale) || localePath('/', locale)
  }
}
