// What the site reads from the settings (F08-T1): the public keys resolved for one locale (the locale's translation,
// else pt-BR, else the default), never ai_translation, with the cache tags of the pages that show them
import type { NAVIGATION_PAGES, SOCIAL_NETWORKS } from './schemas.ts'

export interface PublicSettings {
  identity: { name: string, role: string, bio: string }
  social: { network: (typeof SOCIAL_NETWORKS)[number], url: string }[]
  /** Only when the owner chose to show it */
  contactEmail: string | null
  /** The default share image, ready for og:image: the largest JPEG up to 1200 px, as an absolute URL */
  seo: { titleTemplate: string, description: string, ogImage: { url: string, width: number, height: number, alt: string } | null }
  navigation: (typeof NAVIGATION_PAGES)[number][]
  footer: { text: string, showSocial: boolean }
  features: { contactForm: boolean, rss: boolean }
  cacheTags: string[]
}

/**
 * What the site shows before any setting is saved (an empty database), and while a locale's settings load. Kept
 * here, without zod, for the public bundle; tests/unit/settings.test.ts checks it against the schema defaults
 */
export const PUBLIC_SETTINGS_DEFAULTS: PublicSettings = {
  identity: { name: '[PLACEHOLDER]', role: '[PLACEHOLDER]', bio: '' },
  social: [],
  contactEmail: null,
  seo: { titleTemplate: '%s — [PLACEHOLDER]', description: '[PLACEHOLDER]', ogImage: null },
  navigation: ['projects', 'blog', 'about', 'contact'],
  footer: { text: '', showSocial: true },
  features: { contactForm: true, rss: true },
  cacheTags: [],
}
