// Admin-only. Revisions as the admin API returns them (F06-T2), and a snapshot read as the fields the diff compares:
// its localization and entity fields side by side, for articles and projects alike (F07-T1)
import type { DocumentJson } from '#shared/content/document-schema'
import type { RevisionKind } from '#shared/types/enums'
import type { AnyVersionFields } from './document-diff'

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
    entity: Record<string, unknown>
    localization: { body: DocumentJson, [field: string]: unknown }
  }
}

export function versionFieldsOf(snapshot: RevisionDetail['snapshot']): AnyVersionFields {
  return { ...snapshot.entity, ...snapshot.localization }
}
