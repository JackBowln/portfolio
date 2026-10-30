// Public paths of content (docs/architecture/i18n-seo.md §2): the blog path is the same in every locale and the
// projects path is translated, both prefixed by the locale except for the default one. Redirects and links to
// published articles and projects are built here
import { SOURCE_LOCALE } from '../types/enums.ts'
import type { Locale } from '../types/enums.ts'

export function articlePath(locale: Locale, slug: string): string {
  return `${locale === SOURCE_LOCALE ? '' : `/${locale}`}/blog/${slug}`
}

/** Paths that can be an article (or an old one with a redirect): /blog/{slug} and /{locale}/blog/{slug} */
export const ARTICLE_PATH = /^(?:\/(?:en|es|de|fr))?\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The projects segment per locale (app/pages/projetos) */
export const PROJECTS_SEGMENT: Record<Locale, string> = { 'pt-BR': 'projetos', 'en': 'projects', 'es': 'proyectos', 'de': 'projekte', 'fr': 'projets' }

export function projectPath(locale: Locale, slug: string): string {
  return `${locale === SOURCE_LOCALE ? '' : `/${locale}`}/${PROJECTS_SEGMENT[locale]}/${slug}`
}

/** Paths that can be a project: /projetos/{slug}, /en/projects/{slug}… */
export const PROJECT_PATH = /^(?:\/projetos|\/en\/projects|\/es\/proyectos|\/de\/projekte|\/fr\/projets)\/[a-z0-9]+(?:-[a-z0-9]+)*$/
