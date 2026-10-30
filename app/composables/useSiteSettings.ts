// The global settings on the public site (F08-T1): the layout loads the locale's settings once (during SSR, sent in
// the payload; again after a client-side switch to another locale) and adds their `settings` tag to the page, so a
// save purges every page that shows them. Everything else reads them synchronously; before they arrive (or when
// they cannot be read on the error page), the defaults
import type { PublicSettings } from '#shared/settings/public'
import { PUBLIC_SETTINGS_DEFAULTS } from '#shared/settings/public'

const useStore = () => useState<Partial<Record<string, PublicSettings>>>('site-settings', () => ({}))

/** For the layout: loads a locale's settings. Composables are taken first, so the loader can run after an await */
export function useSiteSettingsLoader(): (locale: string) => Promise<void> {
  const store = useStore()
  const requestFetch = useRequestFetch()
  const cacheTag = import.meta.server ? useResponseHeader('cache-tag') : null
  const pageError = useError()
  return async (locale) => {
    if (!store.value[locale]) {
      try {
        store.value = { ...store.value, [locale]: await requestFetch('/api/public/settings', { query: { locale } }) as PublicSettings }
      }
      catch {
        // The error page shows the defaults; elsewhere a failed read is a server error (never cached with defaults)
        if (pageError.value) {
          return
        }
        throw createError({ statusCode: 500, statusMessage: 'Server Error', fatal: true })
      }
    }
    if (cacheTag && store.value[locale]) {
      cacheTag.value = mergeCacheTags(cacheTag.value, store.value[locale].cacheTags)
    }
  }
}

/** The active locale's settings */
export function useSiteSettings(): ComputedRef<PublicSettings> {
  const store = useStore()
  const { locale } = useI18n()
  return computed(() => store.value[locale.value] ?? PUBLIC_SETTINGS_DEFAULTS)
}
