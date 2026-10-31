// Translated paths of the static pages (i18n-seo §2), for the server side (sitemap) where i18n composables do not exist.
// The pages declare the same paths in definePageMeta, which @nuxtjs/i18n reads as literals; the sitemap crawl test
// (tests/api/seo.spec.ts) fails if the two drift apart.
import type { Locale } from '../types/enums.ts'

export type StaticPage = 'home' | 'about' | 'projects' | 'blog' | 'contact' | 'privacy'

export const STATIC_PAGE_PATHS: Record<StaticPage, Record<Locale, string>> = {
  home: { 'pt-BR': '/', 'en': '/', 'es': '/', 'de': '/', 'fr': '/' },
  about: { 'pt-BR': '/sobre', 'en': '/about', 'es': '/sobre-mi', 'de': '/ueber-mich', 'fr': '/a-propos' },
  projects: { 'pt-BR': '/projetos', 'en': '/projects', 'es': '/proyectos', 'de': '/projekte', 'fr': '/projets' },
  blog: { 'pt-BR': '/blog', 'en': '/blog', 'es': '/blog', 'de': '/blog', 'fr': '/blog' },
  contact: { 'pt-BR': '/contato', 'en': '/contact', 'es': '/contacto', 'de': '/kontakt', 'fr': '/contact' },
  privacy: { 'pt-BR': '/privacidade', 'en': '/privacy', 'es': '/privacidad', 'de': '/datenschutz', 'fr': '/confidentialite' },
}
