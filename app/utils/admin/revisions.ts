// Admin-only. Revisions as the admin API returns them (F06-T2), and a snapshot read as the fields the diff compares
import type { DocumentJson } from '#shared/content/document-schema'
import type { RevisionKind } from '#shared/types/enums'
import type { VersionFields } from './document-diff'

export interface RevisionItem {
  id: string
  number: number
  kind: RevisionKind
  note: string | null
  authorName: string | null
  createdAt: string
}

export interface RevisionDetail extends RevisionItem {
  snapshot: {
    entity: { coverMediaId: string | null, tagIds: string[] }
    localization: { title: string, slug: string, excerpt: string, body: DocumentJson, seoTitle: string | null, seoDescription: string | null, ogImageMediaId: string | null, noindex: boolean }
  }
}

export function versionFieldsOf(snapshot: RevisionDetail['snapshot']): VersionFields {
  return { ...snapshot.localization, coverMediaId: snapshot.entity.coverMediaId, tagIds: snapshot.entity.tagIds }
}
