// Admin-only. Institutional pages as the admin API returns them (F08-T2), and how a page's blocks read as the fields
// the history and the conflict dialog compare (each block a field, decision 3)
import type { DocumentJson } from '#shared/content/document-schema'
import type { Locale, PageKey, PublicationStatus } from '#shared/types/enums'
import type { AnyVersionFields } from './document-diff'

export interface PageLocalization {
  id: string
  locale: Locale
  blocks: Record<string, unknown>
  seoTitle: string | null
  seoDescription: string | null
  ogImageMediaId: string | null
  noindex: boolean
  status: PublicationStatus
  version: number
  updatedAt: string
  publishedAt: string | null
  scheduledAt: string | null
  publishedSnapshot: { localization: { blocks: Record<string, unknown>, seoTitle: string | null, seoDescription: string | null, ogImageMediaId: string | null, noindex: boolean } } | null
}

export interface PageDetail {
  id: string
  key: PageKey
  localizations: PageLocalization[]
}

export interface PageListItem {
  key: PageKey
  localizations: { locale: Locale, status: PublicationStatus, version: number, updatedAt: string, publishedAt: string | null }[]
}

const EMPTY_DOC: DocumentJson = { type: 'doc', content: [] }

/** The compared fields of a page: each block, then the SEO fields; the body is its rich-text block, if any */
export function pageFields(fields: { blocks: Record<string, unknown>, seoTitle: string | null, seoDescription: string | null, ogImageMediaId: string | null, noindex: boolean }): AnyVersionFields {
  const { blocks, ...seo } = fields
  const body = (blocks.intro ?? blocks.body) as DocumentJson | null | undefined
  return { ...blocks, ...seo, body: body && typeof body === 'object' ? body : EMPTY_DOC }
}

export function pageDiffFields(blocks: Record<string, unknown>): string[] {
  return [...Object.keys(blocks), 'seoTitle', 'seoDescription', 'noindex', 'ogImageMediaId']
}
