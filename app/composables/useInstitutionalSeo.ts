// Head of an institutional page (F08-T2, i18n-seo §3): its SEO title and description, else the page's name and the
// site's default description; hreflang only for the locales where it is published; noindex while it falls back to
// pt-BR, while nothing is published, or when the owner asked
import type { PublicPage } from '#shared/pages/public'

export function useInstitutionalSeo(data: Ref<PublicPage>, title: () => string, options: { description?: () => string | undefined, titleTemplate?: string } = {}) {
  const settings = useSiteSettings()
  usePageSeo({
    title: () => data.value.seo.title ?? title(),
    description: () => data.value.seo.description || options.description?.() || settings.value.seo.description,
    published: () => data.value.published,
    noindex: () => data.value.fallback || data.value.empty || data.value.seo.noindex,
    ...(options.titleTemplate ? { titleTemplate: options.titleTemplate } : {}),
  })
}
