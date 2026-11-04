// Head SEO of every public page (ADR-0008 §4), built by shared/seo/head.ts. hreflang lists only the locales where
// the page is published; useLocaleHead is not used because it would emit alternates for untranslated locales. The
// title template, site name and default share image come from the settings (F08-T1); a page may pass its own
// share image (F11-T2)
import { LOCALES } from '#shared/types/enums'
import type { Locale } from '#shared/types/enums'
import { buildSeoHead } from '#shared/seo/head'
import type { SeoInput } from '#shared/seo/head'
import type { ShareImage } from '#shared/media/public'

export interface PageSeoOptions {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  /** Locales where this page is published; static pages default to all, content passes its approved translations */
  published?: MaybeRefOrGetter<readonly Locale[]>
  /** Defaults to the locale's template in the SEO settings; the home passes '%s' */
  titleTemplate?: string
  type?: SeoInput['type']
  noindex?: MaybeRefOrGetter<boolean>
  /** List pages after the first keep ?page=N in the canonical (F06-T5) */
  page?: MaybeRefOrGetter<number>
  publishedTime?: MaybeRefOrGetter<string | undefined>
  modifiedTime?: MaybeRefOrGetter<string | undefined>
  /** The page's own share image (F11-T2); the settings' default when absent */
  image?: MaybeRefOrGetter<ShareImage | null | undefined>
}

export function usePageSeo(options: PageSeoOptions) {
  const { locale } = useI18n()
  const route = useRoute()
  const settings = useSiteSettings()
  const switchLocalePath = useSwitchLocalePath()
  const { siteUrl } = useRuntimeConfig().public

  const head = computed(() => {
    const published = toValue(options.published) ?? LOCALES
    const { seo, identity } = settings.value
    const image = toValue(options.image) ?? seo.ogImage
    return buildSeoHead({
      siteUrl,
      locale: locale.value as Locale,
      path: route.path,
      title: toValue(options.title),
      titleTemplate: options.titleTemplate ?? seo.titleTemplate,
      siteName: identity.name,
      ...(image ? { image } : {}),
      description: toValue(options.description),
      alternates: Object.fromEntries(published.map(code => [code, switchLocalePath(code)])),
      noindex: toValue(options.noindex) ?? false,
      ...(options.type ? { type: options.type } : {}),
      ...(options.page ? { page: toValue(options.page) } : {}),
      ...(toValue(options.publishedTime) ? { publishedTime: toValue(options.publishedTime)! } : {}),
      ...(toValue(options.modifiedTime) ? { modifiedTime: toValue(options.modifiedTime)! } : {}),
    })
  })

  useHead({
    title: () => head.value.title,
    meta: () => head.value.meta,
    link: () => head.value.link,
  })
}
