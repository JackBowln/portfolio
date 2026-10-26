// Skeleton pages (F02-T2): translated title and placeholder description through usePageSeo; noindex unless the page
// is listed as indexable in shared/i18n/routes.ts (also what the sitemap includes)
export function usePlaceholderPage(titleKey: string, options: { indexable?: boolean } = {}) {
  const { t } = useI18n()
  usePageSeo({
    title: () => t(titleKey),
    description: () => t('seo.defaultDescription'),
    noindex: !options.indexable,
  })
}
