// The blog's RSS in the head of its pages (i18n-seo §6): <link rel="alternate" type="application/rss+xml">, unless
// the feature settings turned the RSS off (F08-T1)
import { localizedPath } from '#shared/i18n/locales'
import type { Locale } from '#shared/types/enums'

export function useBlogFeed() {
  const { locale, t } = useI18n()
  const settings = useSiteSettings()
  useHead({
    link: () => (settings.value.features.rss ? [{ rel: 'alternate', type: 'application/rss+xml', title: t('blog.rss'), href: localizedPath(locale.value as Locale, '/rss.xml') }] : []),
  })
}
