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
  const url = absoluteUrl(input.siteUrl, input.path)
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
  if (input.noindex) {
    meta.push({ name: 'robots', content: 'noindex' })
  }

  const link: SeoHead['link'] = [{ rel: 'canonical', href: url }]
  // hreflang only makes sense for indexable pages with more than the original language
  if (!input.noindex && alternates.length > 0) {
    link.push(...alternates.map(({ locale, href }) => ({ rel: 'alternate' as const, hreflang: locale, href })))
    const fallback = alternates.find(({ locale }) => locale === xDefaultLocale(published))
    if (fallback) {
      link.push({ rel: 'alternate', hreflang: 'x-default', href: fallback.href })
    }
  }

  return { title, meta, link }
}
