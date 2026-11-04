// What the public page API returns (F08-T2): the published blocks of the locale, or of pt-BR as a fallback, the
// locales where the page is published (hreflang), and the cache tags the page sets on its own response
import type { BlogCard } from '../content/blog.ts'
import type { ProjectCard } from '../content/projects-public.ts'
import type { PublicMediaMap } from '../media/public.ts'
import type { Locale, PageKey } from '../types/enums.ts'

export interface PublicPage<B = unknown> {
  key: PageKey
  /** Shown in pt-BR with a notice: no published translation in the requested locale */
  fallback: boolean
  /** Nothing published yet: an empty state (noindex) */
  empty: boolean
  blocks: B | null
  /** Locales where the page is published, for hreflang */
  published: Locale[]
  seo: { title: string | null, description: string | null, noindex: boolean }
  media: PublicMediaMap
  /** The home's featured projects and latest articles (decision 2) */
  home?: { projects: ProjectCard[], articles: BlogCard[] }
  /** When the copy shown was published (F11-T1, the about page's dateModified) */
  publishedAt?: string
  /** JSON-LD, serialized on the server (F11-T1); the page puts it in <head> as it is */
  jsonLd?: string
  cacheTags: string[]
}

/** Plain text split into paragraphs at blank lines */
export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)
}
