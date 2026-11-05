// The query parameters a public page reads (F11-T4, ADR-0003 decision 3): `page` on the blog and topic lists, `tech`
// on the projects list. Any other parameter (utm_*, a typo) would make a new cache entry and a full SSR, so the
// middleware answers a 301 to the URL without it. Pure, so it is unit-tested
import { TOPICS_SEGMENT } from '../content/paths.ts'
import { localizedPath } from '../i18n/locales.ts'
import { STATIC_PAGE_PATHS } from '../i18n/routes.ts'
import { LOCALES } from '../types/enums.ts'

const BLOG_LISTS = new Set(LOCALES.map(locale => localizedPath(locale, STATIC_PAGE_PATHS.blog[locale])))
const PROJECT_LISTS = new Set(LOCALES.map(locale => localizedPath(locale, STATIC_PAGE_PATHS.projects[locale])))
const TOPIC_PAGE = new RegExp(`^(?:/(?:en|es|de|fr))?/blog/(?:${[...new Set(Object.values(TOPICS_SEGMENT))].join('|')})/[^/]+$`)

/** Paths the Worker answers that are not public pages, or whose queries are their own (test pages, the admin) */
const OWN_QUERIES = ['/api/', '/admin', '/_nuxt/', '/_i18n/', '/media/', '/preview/', '/__', '/_test', '/dev/']

export function allowedParams(path: string): readonly string[] {
  if (BLOG_LISTS.has(path) || TOPIC_PAGE.test(path)) {
    return ['page']
  }
  return PROJECT_LISTS.has(path) ? ['tech'] : []
}

/**
 * The URL to redirect to, or null when the query only has what the page reads (each once). Kept parameters keep
 * their first value, in a fixed order
 */
export function canonicalQueryTarget(path: string, search: string): string | null {
  if (!search || search === '?' || OWN_QUERIES.some(prefix => path.startsWith(prefix))) {
    return null
  }
  const params = new URLSearchParams(search)
  const allowed = allowedParams(path)
  const kept = new URLSearchParams()
  for (const name of allowed) {
    const value = params.get(name)
    if (value !== null) {
      kept.set(name, value)
    }
  }
  const query = kept.toString()
  const current = params.toString()
  return query === current ? null : `${path}${query ? `?${query}` : ''}`
}
