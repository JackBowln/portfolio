// Skeleton pages (F02-T2): translated title and noindex until each page gets its own phase and usePageSeo (F02-T3)
export function usePlaceholderPage(titleKey: string) {
  const { t } = useI18n()
  useHead({
    title: () => t(titleKey),
    meta: [{ name: 'robots', content: 'noindex' }],
  })
}
