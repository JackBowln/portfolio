// docs/architecture/i18n-seo.md §1: per-locale constants shared by the head, the sitemap and JSON-LD
import type { Locale } from '../types/enums.ts'

export const OG_LOCALES: Record<Locale, string> = {
  'pt-BR': 'pt_BR',
  'en': 'en_US',
  'es': 'es_ES',
  'de': 'de_DE',
  'fr': 'fr_FR',
}

// URL prefix per locale (strategy prefix_except_default)
export const LOCALE_PREFIXES: Record<Locale, string> = {
  'pt-BR': '',
  'en': '/en',
  'es': '/es',
  'de': '/de',
  'fr': '/fr',
}

// x-default points to English when it is published, otherwise to the pt-BR original (ADR-0008 §4)
export function xDefaultLocale(published: readonly Locale[]): Locale {
  return published.includes('en') ? 'en' : 'pt-BR'
}

export function localizedPath(locale: Locale, path: string): string {
  const prefixed = `${LOCALE_PREFIXES[locale]}${path === '/' ? '' : path}`
  return prefixed || '/'
}
