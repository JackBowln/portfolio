// Head SEO of every public page (ADR-0008 §4), built by shared/seo/head.ts. hreflang lists only the locales where
// the page is published; useLocaleHead is not used because it would emit alternates for untranslated locales
import { LOCALES } from '#shared/types/enums'
import type { Locale } from '#shared/types/enums'
import { buildSeoHead } from '#shared/seo/head'
import type { SeoInput } from '#shared/seo/head'

export interface PageSeoOptions {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  /** Locales where this page is published; static pages default to all, content passes its approved translations */
  published?: MaybeRefOrGetter<readonly Locale[]>
  /** Defaults to the locale's `seo.titleTemplate`; the home passes '%s' */
  titleTemplate?: string
  type?: SeoInput['type']
  noindex?: MaybeRefOrGetter<boolean>
  /** List pages after the first keep ?page=N in the canonical (F06-T5) */
  page?: MaybeRefOrGetter<number>
  publishedTime?: MaybeRefOrGetter<string | undefined>
  modifiedTime?: MaybeRefOrGetter<string | undefined>
}

export function usePageSeo(options: PageSeoOptions) {
  const { locale, t } = useI18n()
  const route = useRoute()
  const switchLocalePath = useSwitchLocalePath()
  const { siteUrl } = useRuntimeConfig().public

  const head = computed(() => {
    const published = toValue(options.published) ?? LOCALES
    return buildSeoHead({
      siteUrl,
      locale: locale.value as Locale,
      path: route.path,
      title: toValue(options.title),
      titleTemplate: options.titleTemplate ?? t('seo.titleTemplate'),
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
