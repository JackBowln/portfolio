// What the public projects API returns (F07-T2): only published content, media in the public shape, and the cache
// tags the page sets on its own response, so a purge reaches the HTML as well as the data
import type { PublicImage, PublicMediaMap } from '../media/public.ts'
import type { Locale } from '../types/enums.ts'
import type { DocumentJson } from './document-schema.ts'

export const PROJECTS_MAX = 60
export const RELATED_PROJECTS = 3

export interface ProjectTechnology {
  name: string
  slug: string
  /** Published projects with it in the locale; in the filter only */
  count?: number
}

export interface ProjectCard {
  slug: string
  title: string
  summary: string
  cover: PublicImage | null
  /** YYYY-MM */
  periodStart: string | null
  periodEnd: string | null
  featured: boolean
  technologies: ProjectTechnology[]
}

export interface ProjectList {
  items: ProjectCard[]
  /** Technologies of the locale's published projects, for the filter */
  technologies: ProjectTechnology[]
  /** The technology the list is filtered by */
  technology: ProjectTechnology | null
  /** JSON-LD, serialized on the server (F11-T1); the page puts it in <head> as it is */
  jsonLd?: string
  cacheTags: string[]
}

export interface PublicProject {
  locale: Locale
  title: string
  summary: string
  role: string
  periodStart: string | null
  periodEnd: string | null
  repoUrl: string | null
  demoUrl: string | null
  /** Verifiable results: what was measured, the value, and how */
  highlights: { label: string, value: string, note?: string | undefined }[]
  body: DocumentJson
  /** The gallery as a document (one image, or a grid gallery), rendered like the body */
  gallery: DocumentJson | null
  media: PublicMediaMap
  cover: PublicImage | null
  technologies: ProjectTechnology[]
  related: ProjectCard[]
  /** Published locales and their slugs, for hreflang and the language switcher */
  alternates: { locale: Locale, slug: string }[]
  seo: { title: string, description: string, noindex: boolean }
  /** JSON-LD, serialized on the server (F11-T1); the page puts it in <head> as it is */
  jsonLd?: string
  cacheTags: string[]
}

/** The technology filter from `?tech=`: a slug, nothing, or null for anything else (a 404) */
export function parseTechnology(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  const text = String(value)
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text) && text.length <= 80 ? text : null
}
