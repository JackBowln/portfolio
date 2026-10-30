// Sitemap XML with hreflang alternates (Google "localized versions"): one <url> per locale, each listing all its
// published alternates plus x-default
import type { Locale } from '../types/enums.ts'
import { xDefaultLocale } from '../i18n/locales.ts'
import { escapeXml } from './xml.ts'

export interface SitemapEntry {
  /** Absolute URL per published locale */
  urls: Partial<Record<Locale, string>>
  lastmod?: string
}

export function buildSitemap(entries: readonly SitemapEntry[]): string {
  const blocks: string[] = []
  for (const entry of entries) {
    const published = Object.keys(entry.urls) as Locale[]
    const links = published.map(locale => `    <xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(entry.urls[locale] ?? '')}"/>`)
    const fallback = entry.urls[xDefaultLocale(published)]
    if (fallback) {
      links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(fallback)}"/>`)
    }
    for (const locale of published) {
      blocks.push([
        '  <url>',
        `    <loc>${escapeXml(entry.urls[locale] ?? '')}</loc>`,
        ...(entry.lastmod ? [`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`] : []),
        ...links,
        '  </url>',
      ].join('\n'))
    }
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...blocks,
    '</urlset>',
    '',
  ].join('\n')
}
