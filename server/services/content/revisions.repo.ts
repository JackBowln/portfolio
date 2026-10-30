// Revisions (data-model §4.3, ADR-0006 §6): immutable gzip snapshots of the canonical JSON, numbered 1, 2, 3… per
// localization. The hash is of the canonical JSON, so key order never makes two revisions differ
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { contentHash } from '../../../shared/content/canonical-json.ts'
import { gunzipSnapshot, gzipSnapshot, snapshotSchemas } from '../../../shared/content/snapshot.ts'
import type { ContentType, Snapshot, SnapshotInput } from '../../../shared/content/snapshot.ts'
import type { Locale, RevisionKind } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { users } from '../../db/schema/auth.ts'
import { contentTables } from './content-tables.ts'
import type { ContentTables } from './content-tables.ts'

/**
 * Repeats are dropped for these kinds (F06-T2, decision 3): an autosave equal to the latest revision of any kind, and
 * a manual version equal to the latest manual one with the same note, so a named version is kept even when an
 * autosave already holds its content. Publish, restore and AI always record their event
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

/** SQL true when a revision of this kind and content is not a repeat to drop (see DEDUPLICATED_KINDS) */
function notARepeat(revisions: ContentTables['article']['revisions'], localizationId: string, kind: RevisionKind, hash: string, note: string | null): SQL | undefined {
  if (kind === 'autosave') {
    return sql`coalesce((SELECT ${revisions.contentHash} FROM ${revisions} WHERE ${revisions.localizationId} = ${localizationId} ORDER BY ${revisions.number} DESC LIMIT 1), '') <> ${hash}`
  }
  if (kind === 'manual') {
    return sql`NOT EXISTS (SELECT 1 FROM (SELECT ${revisions.contentHash} AS hash, ${revisions.note} AS note FROM ${revisions}
      WHERE ${revisions.localizationId} = ${localizationId} AND ${revisions.kind} = 'manual' ORDER BY ${revisions.number} DESC LIMIT 1) last
      WHERE last.hash = ${hash} AND last.note IS ${note})`
  }
  return undefined
}

export interface PreparedRevision {
  id: string
  localizationId: string
  entityId: string
  locale: Locale
  kind: RevisionKind
  snapshotGz: Uint8Array
  contentHash: string
  note: string | null
  createdBy: string | null
}

/** Compresses and hashes a snapshot, so the insert can join a batch (CompressionStream is async) */
export async function prepareRevision<T extends ContentType>(type: T, input: NewRevision<T>): Promise<PreparedRevision> {
  const snapshot = snapshotSchemas[type].parse(input.snapshot)
  return {
    id: uuidv7(),
    localizationId: input.localizationId,
    entityId: input.entityId,
    locale: input.locale,
    kind: input.kind,
    snapshotGz: await gzipSnapshot(snapshot),
    contentHash: await contentHash(snapshot),
    note: input.note ?? null,
    createdBy: input.createdBy ?? null,
  }
}

/**
 * The INSERT of a prepared revision for a batch: written only when `guard` holds (for instance "this save's working
 * copy update took effect") and the revision is not a repeat. The number is computed in the statement itself, so two
 * saves cannot read the same maximum; the unique index is the backstop
 */
export function insertRevisionStatement(db: Db, type: ContentType, revision: PreparedRevision, guard?: SQL) {
  const { revisions, entityKey } = tablesOf(type)
  const value = <T>(item: unknown, column: string) => sql<T>`${item}`.as(column)
  return db.insert(revisions).select(db.select({
    id: value<string>(revision.id, 'id'),
    localizationId: value<string>(revision.localizationId, 'localization_id'),
    locale: value<Locale>(revision.locale, 'locale'),
    number: sql<number>`(SELECT coalesce(max(${revisions.number}), 0) + 1 FROM ${revisions} WHERE ${revisions.localizationId} = ${revision.localizationId})`.as('number'),
    kind: value<RevisionKind>(revision.kind, 'kind'),
    snapshotGz: value<Uint8Array>(revision.snapshotGz, 'snapshot_gz'),
    contentHash: value<string>(revision.contentHash, 'content_hash'),
    note: value<string | null>(revision.note, 'note'),
    createdBy: value<string | null>(revision.createdBy, 'created_by'),
    createdAt: value<Date>(Date.now(), 'created_at'),
    [entityKey]: value<string>(revision.entityId, entityKey === 'articleId' ? 'article_id' : entityKey === 'projectId' ? 'project_id' : 'page_id'),
  } as never).from(sql`(SELECT 1)`).where(and(guard, notARepeat(revisions, revision.localizationId, revision.kind, revision.contentHash, revision.note)))).returning(metaColumns(revisions))
}

/** `created: false` when the save repeats a revision (see DEDUPLICATED_KINDS), which is returned instead */
export async function createRevision<T extends ContentType>(db: Db, type: T, input: NewRevision<T>): Promise<{ revision: RevisionMeta, created: boolean }> {
  const { revisions } = tablesOf(type)
  const prepared = await prepareRevision(type, input)
  const [revision] = await insertRevisionStatement(db, type, prepared)
  if (revision) {
    return { revision, created: true }
  }
  // Dropped as a repeat: the revision it repeats
  const [latest] = await db.select(metaColumns(revisions)).from(revisions)
    .where(and(eq(revisions.localizationId, input.localizationId), DEDUPLICATED_KINDS.has(input.kind) && input.kind === 'manual' ? eq(revisions.kind, 'manual') : undefined))
    .orderBy(desc(revisions.number)).limit(1)
  return { revision: latest!, created: false }
}

/** Author names for revision lists */
export async function userNames(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) {
    return new Map()
  }
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, unique))
  return new Map(rows.map(row => [row.id, row.name]))
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
