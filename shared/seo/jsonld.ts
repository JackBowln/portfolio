// Typed JSON-LD helpers (ADR-0008 §7, i18n-seo §5, F11-T1). Only what the page shows; stable @id (the site's
// #person and #website, a page's canonical URL with a #fragment); always inLanguage; no empty field. Built on the
// server and sent as a ready string, so no helper reaches the public JS
import type { Locale } from '../types/enums.ts'

export type JsonLd = Record<string, unknown>

const base = (siteUrl: string) => siteUrl.replace(/\/$/, '')

export function personId(siteUrl: string): string {
  return `${base(siteUrl)}/#person`
}

export function websiteId(siteUrl: string): string {
  return `${base(siteUrl)}/#website`
}

/** Leaves out undefined, null, empty strings and empty lists */
function compact(node: JsonLd): JsonLd {
  return Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)))
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

export function person(input: { siteUrl: string, name: string, jobTitle?: string | undefined, sameAs?: readonly string[] | undefined }): JsonLd {
  return compact({
    '@type': 'Person',
    '@id': personId(input.siteUrl),
    'url': `${base(input.siteUrl)}/`,
    'name': input.name,
    'jobTitle': input.jobTitle,
    'sameAs': input.sameAs ? [...input.sameAs] : undefined,
  })
}

export function profilePage(input: { url: string, name: string, locale: Locale, siteUrl: string, dateModified?: string | undefined }): JsonLd {
  return compact({
    '@type': 'ProfilePage',
    '@id': `${input.url}#page`,
    'url': input.url,
    'name': input.name,
    'inLanguage': input.locale,
    'dateModified': input.dateModified,
    'mainEntity': { '@id': personId(input.siteUrl) },
    'isPartOf': { '@id': websiteId(input.siteUrl) },
  })
}

export function blogPosting(input: { url: string, headline: string, description?: string | undefined, locale: Locale, siteUrl: string, datePublished: string, dateModified: string, image?: string | undefined, keywords?: readonly string[] | undefined }): JsonLd {
  return compact({
    '@type': 'BlogPosting',
    '@id': `${input.url}#article`,
    'url': input.url,
    'mainEntityOfPage': input.url,
    'headline': input.headline,
    'description': input.description,
    'inLanguage': input.locale,
    'datePublished': input.datePublished,
    'dateModified': input.dateModified,
    'author': { '@id': personId(input.siteUrl) },
    'image': input.image,
    'keywords': input.keywords?.length ? input.keywords.join(', ') : undefined,
    'isPartOf': { '@id': websiteId(input.siteUrl) },
  })
}

/** A project: a SoftwareSourceCode (a CreativeWork) when it has a repository, a CreativeWork otherwise */
export function creativeWork(input: { url: string, name: string, description?: string | undefined, locale: Locale, siteUrl: string, image?: string | undefined, keywords?: readonly string[] | undefined, codeRepository?: string | null | undefined }): JsonLd {
  return compact({
    '@type': input.codeRepository ? 'SoftwareSourceCode' : 'CreativeWork',
    '@id': `${input.url}#work`,
    'url': input.url,
    'name': input.name,
    'description': input.description,
    'inLanguage': input.locale,
    'image': input.image,
    'keywords': input.keywords?.length ? input.keywords.join(', ') : undefined,
    'codeRepository': input.codeRepository ?? undefined,
    'author': { '@id': personId(input.siteUrl) },
  })
}

export function collectionPage(input: { url: string, name: string, locale: Locale, siteUrl: string }): JsonLd {
  return {
    '@type': 'CollectionPage',
    '@id': `${input.url}#page`,
    'url': input.url,
    'name': input.name,
    'inLanguage': input.locale,
    'isPartOf': { '@id': websiteId(input.siteUrl) },
  }
}

export function breadcrumbList(input: { url: string, items: readonly { name: string, url: string }[] }): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${input.url}#breadcrumbs`,
    'itemListElement': input.items.map((item, index) => ({ '@type': 'ListItem', 'position': index + 1, 'name': item.name, 'item': item.url })),
  }
}

/**
 * Serializes a graph for <script type="application/ld+json">. `<`, `>` and `&` become \\u escapes (so nothing in
 * the content can close the tag or open a comment), and so do U+2028/U+2029 (line terminators in old parsers)
 */
export function serializeJsonLd(nodes: readonly JsonLd[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
