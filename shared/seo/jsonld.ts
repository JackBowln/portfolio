// Typed JSON-LD helpers (ADR-0008 §7). Only what the page shows; stable @id; always inLanguage
import type { Locale } from '../types/enums.ts'

type JsonLd = Record<string, unknown>

const base = (siteUrl: string) => siteUrl.replace(/\/$/, '')

export function personId(siteUrl: string): string {
  return `${base(siteUrl)}/#person`
}

export function websiteId(siteUrl: string): string {
  return `${base(siteUrl)}/#website`
}

export function website(input: { siteUrl: string, name: string, locale: Locale }): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': websiteId(input.siteUrl),
    'url': `${base(input.siteUrl)}/`,
    'name': input.name,
    'inLanguage': input.locale,
    'publisher': { '@id': personId(input.siteUrl) },
  }
}

export function person(input: { siteUrl: string, name: string, jobTitle?: string, sameAs?: readonly string[] }): JsonLd {
  return {
    '@type': 'Person',
    '@id': personId(input.siteUrl),
    'url': `${base(input.siteUrl)}/`,
    'name': input.name,
    ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
    ...(input.sameAs?.length ? { sameAs: [...input.sameAs] } : {}),
  }
}

/** Serializes a graph for <script type="application/ld+json">; `<` is escaped so content can never close the tag */
export function serializeJsonLd(nodes: readonly JsonLd[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })
    .replace(/</g, '\\u003c')
}
