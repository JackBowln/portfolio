// What the public blog API returns (F06-T5): only published content, media in the public shape, and the cache tags
// the page sets on its own response, so a purge reaches the HTML as well as the data
import type { PublicImage, PublicMediaMap } from '../media/public.ts'
import type { Locale } from '../types/enums.ts'
import type { DocumentJson } from './document-schema.ts'

export const BLOG_PAGE_SIZE = 10
export const RELATED_LIMIT = 3
export const RSS_ITEMS = 20

export interface BlogCard {
  slug: string
  title: string
  excerpt: string
  cover: PublicImage | null
  readingTimeMin: number | null
  /** ISO dates */
  firstPublishedAt: string
  publishedAt: string
}

export interface BlogTopic {
  name: string
  slug: string
  count?: number
}

export interface BlogList {
  items: BlogCard[]
  page: number
  pages: number
  total: number
  topics: BlogTopic[]
  cacheTags: string[]
}

export interface BlogTopicPage extends BlogList {
  topic: BlogTopic
}

export interface BlogArticle {
  locale: Locale
  title: string
  excerpt: string
  body: DocumentJson
  media: PublicMediaMap
  cover: PublicImage | null
  readingTimeMin: number
  firstPublishedAt: string
  publishedAt: string
  topics: BlogTopic[]
  related: BlogCard[]
  /** Published locales and their slugs, for hreflang and the language switcher */
  alternates: { locale: Locale, slug: string }[]
  seo: { title: string, description: string, noindex: boolean }
  cacheTags: string[]
}

/** Pages for `total` items; at least 1, so an empty blog still has its first page */
/**
 * The card whose cover gets priority (the LCP of a list): the first one with a cover, if it is among the first two,
 * which are above the fold; otherwise none, since eager-loading a cover further down only competes with the page
 */
export function priorityCover(items: readonly { cover: unknown }[]): number {
  const index = items.findIndex(item => item.cover)
  return index >= 0 && index < 2 ? index : -1
}

export function pageCount(total: number, size = BLOG_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size))
}

/** The page number from `?page=`: a positive integer, or null for anything else (a 404) */
export function parsePage(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return 1
  }
  const text = String(value)
  return /^[1-9]\d{0,5}$/.test(text) ? Number(text) : null
}
