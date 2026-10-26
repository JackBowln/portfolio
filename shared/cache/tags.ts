// Cache-Tag vocabulary from ADR-0003 §2; purge events in §3 build tags with these same helpers
import type { Locale, PageKey } from '../types/enums.ts'

const MAX_TAG_LENGTH = 1024
// Printable ASCII without spaces or commas (commas separate tags in the header)
const TAG_PATTERN = /^[\x21-\x2B\x2D-\x7E]+$/

export function isValidCacheTag(tag: string): boolean {
  return tag.length > 0 && tag.length <= MAX_TAG_LENGTH && TAG_PATTERN.test(tag)
}

export function assertValidCacheTags(tags: readonly string[]): void {
  const invalid = tags.filter(tag => !isValidCacheTag(tag))
  if (invalid.length > 0) {
    throw new Error(`Invalid cache tag(s): ${invalid.map(tag => JSON.stringify(tag.slice(0, 40))).join(', ')}`)
  }
}

export const cacheTags = {
  site: () => 'site',
  locale: (locale: Locale) => `locale:${locale}`,
  page: (key: PageKey, locale: Locale) => `page:${key}:${locale}`,
  article: (id: string) => `article:${id}`,
  articleLocale: (id: string, locale: Locale) => `article:${id}:${locale}`,
  project: (id: string) => `project:${id}`,
  projectLocale: (id: string, locale: Locale) => `project:${id}:${locale}`,
  blogList: (locale: Locale) => `list:blog:${locale}`,
  projectList: (locale: Locale) => `list:projects:${locale}`,
  tag: (id: string) => `tag:${id}`,
  settings: () => 'settings',
  media: (id: string) => `media:${id}`,
  sitemap: () => 'sitemap',
  rss: (locale: Locale) => `rss:${locale}`,
  redirects: () => 'redirects',
  // UI messages served to the client by @nuxtjs/i18n (/_i18n/<hash>/<locale>/messages.json)
  i18n: () => 'i18n',
} as const
