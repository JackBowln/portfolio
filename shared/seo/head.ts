// Head tags of a public page (docs/architecture/i18n-seo.md §4). Pure, so it is unit-tested; usePageSeo applies it.
import { LOCALES } from '../types/enums.ts'
import type { Locale } from '../types/enums.ts'
import { OG_LOCALES, xDefaultLocale } from '../i18n/locales.ts'

export interface SeoInput {
  siteUrl: string
  locale: Locale
  /** Path of this page in the active locale (with prefix); query and hash are dropped */
  path: string
  title: string
  /** Template with `%s`, from the locale's SEO defaults */
  titleTemplate: string
  description: string
  /** Paths of this page per published locale, including the active one; hreflang lists only these */
  alternates: Partial<Record<Locale, string>>
  type?: 'website' | 'article' | 'profile'
  noindex?: boolean
  /** A list page after the first (F06-T5): canonical keeps `?page=N`; no hreflang, since pages differ per locale */
  page?: number
  /** Articles: ISO dates for article:published_time / article:modified_time */
  publishedTime?: string
  modifiedTime?: string
  /** og:site_name, from the identity settings (F08-T1) */
  siteName?: string
  /** og:image and twitter:image: the page's, or the default of the SEO settings (F08-T1) */
  image?: { url: string, width: number, height: number, alt: string }
}

export interface SeoHead {
  title: string
  meta: ({ name: string, content: string } | { property: string, content: string })[]
  link: ({ rel: 'canonical', href: string } | { rel: 'alternate', hreflang: string, href: string })[]
}

export function absoluteUrl(siteUrl: string, path: string): string {
  const clean = path.split(/[?#]/)[0] || '/'
  return new URL(clean, `${siteUrl.replace(/\/$/, '')}/`).href
}

export function buildSeoHead(input: SeoInput): SeoHead {
  const paged = input.page !== undefined && input.page > 1
  const url = absoluteUrl(input.siteUrl, input.path) + (paged ? `?page=${input.page}` : '')
  const title = input.titleTemplate.replace('%s', input.title)
  const published = LOCALES.filter(locale => input.alternates[locale] !== undefined)
  const alternates = published.map(locale => ({ locale, href: absoluteUrl(input.siteUrl, input.alternates[locale] ?? '/') }))

  const meta: SeoHead['meta'] = [
    { name: 'description', content: input.description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: input.description },
    { property: 'og:url', content: url },
    { property: 'og:type', content: input.type ?? 'website' },
    { property: 'og:locale', content: OG_LOCALES[input.locale] },
    ...published.filter(locale => locale !== input.locale).map(locale => ({ property: 'og:locale:alternate', content: OG_LOCALES[locale] })),
    { name: 'twitter:card', content: 'summary_large_image' },
  ]
  if (input.siteName) {
    meta.push({ property: 'og:site_name', content: input.siteName })
  }
  if (input.image) {
    meta.push(
      { property: 'og:image', content: input.image.url },
      { property: 'og:image:width', content: String(input.image.width) },
      { property: 'og:image:height', content: String(input.image.height) },
      { property: 'og:image:alt', content: input.image.alt },
      { name: 'twitter:image', content: input.image.url },
    )
  }
  if (input.publishedTime) {
    meta.push({ property: 'article:published_time', content: input.publishedTime })
  }
  if (input.modifiedTime) {
    meta.push({ property: 'article:modified_time', content: input.modifiedTime })
  }
  if (input.noindex) {
    meta.push({ name: 'robots', content: 'noindex' })
  }

  const link: SeoHead['link'] = [{ rel: 'canonical', href: url }]
  // hreflang only makes sense for indexable pages with more than the original language
  if (!input.noindex && !paged && alternates.length > 0) {
    link.push(...alternates.map(({ locale, href }) => ({ rel: 'alternate' as const, hreflang: locale, href })))
    const fallback = alternates.find(({ locale }) => locale === xDefaultLocale(published))
    if (fallback) {
      link.push({ rel: 'alternate', hreflang: 'x-default', href: fallback.href })
    }
  }

  return { title, meta, link }
}
