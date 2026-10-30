// The blog's RSS in the head of its pages (i18n-seo §6): <link rel="alternate" type="application/rss+xml">
import { localizedPath } from '#shared/i18n/locales'
import type { Locale } from '#shared/types/enums'

export function useBlogFeed() {
  const { locale, t } = useI18n()
  useHead({
    link: () => [{ rel: 'alternate', type: 'application/rss+xml', title: t('blog.rss'), href: localizedPath(locale.value as Locale, '/rss.xml') }],
  })
}
