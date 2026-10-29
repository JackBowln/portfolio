// Revisions (data-model §4.3, ADR-0006 §6): immutable gzip snapshots of the canonical JSON, numbered 1, 2, 3… per
// localization. The hash is of the canonical JSON, so key order never makes two revisions differ
import { and, desc, eq, sql } from 'drizzle-orm'
import { contentHash } from '../../../shared/content/canonical-json.ts'
import { gunzipSnapshot, gzipSnapshot, snapshotSchemas } from '../../../shared/content/snapshot.ts'
import type { ContentType, Snapshot, SnapshotInput } from '../../../shared/content/snapshot.ts'
import type { Locale, RevisionKind } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { contentTables } from './content-tables.ts'
import type { ContentTables } from './content-tables.ts'

/**
 * Saves that repeat the latest revision are dropped for these kinds. Publish, restore and AI always record their
 * event, even with unchanged content
 */
const DEDUPLICATED_KINDS: ReadonlySet<RevisionKind> = new Set(['autosave', 'manual'])

export interface RevisionMeta {
  id: string
  number: number
  kind: RevisionKind
  contentHash: string
  note: string | null
  createdBy: string | null
  createdAt: Date
}

export interface NewRevision<T extends ContentType> {
  localizationId: string
  entityId: string
  locale: Locale
  kind: RevisionKind
  snapshot: SnapshotInput<T>
  note?: string | null | undefined
  createdBy?: string | null | undefined
}

// Same shape in the three tables apart from the entity key; the cast stays here
const tablesOf = (type: ContentType) => contentTables[type] as unknown as ContentTables['article']

const metaColumns = (revisions: ContentTables['article']['revisions']) => ({
  id: revisions.id,
  number: revisions.number,
  kind: revisions.kind,
  contentHash: revisions.contentHash,
  note: revisions.note,
  createdBy: revisions.createdBy,
  createdAt: revisions.createdAt,
})

/** `created: false` when an autosave or manual save matches the latest revision, which is returned instead */
export async function createRevision<T extends ContentType>(db: Db, type: T, input: NewRevision<T>): Promise<{ revision: RevisionMeta, created: boolean }> {
  const { revisions, entityKey } = tablesOf(type)
  const snapshot = snapshotSchemas[type].parse(input.snapshot)
  const hash = await contentHash(snapshot)
  if (DEDUPLICATED_KINDS.has(input.kind)) {
    const [latest] = await db.select(metaColumns(revisions)).from(revisions)
      .where(eq(revisions.localizationId, input.localizationId)).orderBy(desc(revisions.number)).limit(1)
    if (latest?.contentHash === hash) {
      return { revision: latest, created: false }
    }
  }
  const [revision] = await db.insert(revisions).values({
    localizationId: input.localizationId,
    [entityKey]: input.entityId,
    locale: input.locale,
    // Computed in the INSERT itself, so two saves cannot read the same maximum; the unique index is the backstop
    number: sql<number>`(SELECT coalesce(max(${revisions.number}), 0) + 1 FROM ${revisions} WHERE ${revisions.localizationId} = ${input.localizationId})`,
    kind: input.kind,
    snapshotGz: await gzipSnapshot(snapshot),
    contentHash: hash,
    note: input.note ?? null,
    createdBy: input.createdBy ?? null,
  }).returning(metaColumns(revisions))
  return { revision: revision!, created: true }
}

/** Newest first, without the snapshots */
export async function listRevisions(db: Db, type: ContentType, localizationId: string): Promise<RevisionMeta[]> {
  const { revisions } = tablesOf(type)
  return db.select(metaColumns(revisions)).from(revisions)
    .where(eq(revisions.localizationId, localizationId)).orderBy(desc(revisions.number))
}

/** One revision with its snapshot decompressed and validated; scoped to the localization it belongs to */
export async function getRevision<T extends ContentType>(db: Db, type: T, localizationId: string, id: string): Promise<(RevisionMeta & { snapshot: Snapshot<T> }) | undefined> {
  const { revisions } = tablesOf(type)
  const [row] = await db.select({ ...metaColumns(revisions), snapshotGz: revisions.snapshotGz }).from(revisions)
    .where(and(eq(revisions.id, id), eq(revisions.localizationId, localizationId)))
  if (!row) {
    return undefined
  }
  const { snapshotGz, ...meta } = row
  return { ...meta, snapshot: await gunzipSnapshot(type, snapshotGz) }
}
