// The names of the site's sections in each locale, for JSON-LD breadcrumbs built on the server (F11-T1), where the
// UI messages are not loaded. tests/unit/jsonld.test.ts checks them against i18n/locales (layout.nav, pages.about)
import type { Locale } from '../types/enums.ts'

export const SECTION_NAMES: Record<'blog' | 'projects' | 'about', Record<Locale, string>> = {
  blog: { 'pt-BR': 'Blog', 'en': 'Blog', 'es': 'Blog', 'de': 'Blog', 'fr': 'Blog' },
  projects: { 'pt-BR': 'Projetos', 'en': 'Projects', 'es': 'Proyectos', 'de': 'Projekte', 'fr': 'Projets' },
  about: { 'pt-BR': 'Sobre', 'en': 'About', 'es': 'Sobre mí', 'de': 'Über mich', 'fr': 'À propos' },
}
