// Media queries (data-model §5). Deleted rows stay in the table (soft delete) and are hidden from every read here
import { and, desc, eq, exists, gte, inArray, lt, ne, notExists, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Locale, MediaKind, MediaStatus, MediaTrackKind, MediaUsageContext, TranslationState } from '../../../shared/types/enums.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { chunked } from '../../db/in-limit.ts'
import { media, mediaLocalizations, mediaTracks, mediaUsages } from '../../db/schema/media.ts'

export type MediaRow = typeof media.$inferSelect
export type NewMedia = typeof media.$inferInsert
export type NewTrack = Omit<typeof mediaTracks.$inferInsert, 'mediaId'>

/** The media row, unless it was deleted */
export async function findMedia(db: Db, id: string): Promise<MediaRow | undefined> {
  const [row] = await db.select().from(media).where(and(eq(media.id, id), ne(media.status, 'deleted')))
  return row
}

/** Any row with this hash, deleted ones included: the hash is the R2 address, so it stays taken */
export async function findMediaIdBySha256(db: Db, sha256: string): Promise<string | undefined> {
  const [row] = await db.select({ id: media.id }).from(media).where(eq(media.sha256, sha256))
  return row?.id
}

export async function insertMedia(db: Db, row: NewMedia, tracks: NewTrack[]): Promise<MediaRow> {
  const id = row.id
  if (!id) {
    throw new Error('insertMedia needs an id, so the tracks can reference it in the same batch')
  }
  const insert = db.insert(media).values(row).returning()
  const [inserted] = tracks.length > 0
    ? await db.batch([insert, db.insert(mediaTracks).values(tracks.map(track => ({ ...track, mediaId: id })))])
    : [await insert]
  return inserted[0]!
}

export async function listTracks(db: Db, mediaId: string) {
  return db.select({ locale: mediaTracks.locale, kind: mediaTracks.kind, label: mediaTracks.label, key: mediaTracks.key, size: mediaTracks.size })
    .from(mediaTracks).where(eq(mediaTracks.mediaId, mediaId))
    // Stable order for the <track> list and the upload plan
    .orderBy(mediaTracks.locale, mediaTracks.kind)
}

/** pending → ready, plus the poster use of a video; false if it was no longer pending */
export async function markReady(db: Db, id: string, poster?: { mediaId: string }): Promise<boolean> {
  const update = db.update(media).set({ status: 'ready' }).where(and(eq(media.id, id), eq(media.status, 'pending'))).returning({ id: media.id })
  const [updated] = poster
    ? await db.batch([update, db.insert(mediaUsages).values({ mediaId: poster.mediaId, entityType: 'media', entityId: id, context: 'poster' })])
    : [await update]
  return updated.length > 0
}

export interface LocalizationInput {
  locale: Locale
  alt?: string | undefined
  caption?: string | null | undefined
  credit?: string | null | undefined
  translationState: TranslationState
}

export interface MediaChanges {
  focalX?: number | undefined
  focalY?: number | undefined
  decorative?: boolean | undefined
}

/** Updates the row and upserts the given locales in one batch */
export async function updateMedia(db: Db, id: string, userId: string, changes: MediaChanges, localizations: LocalizationInput[]): Promise<void> {
  const fields = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
  const update = db.update(media).set({ ...fields, updatedBy: userId, updatedAt: new Date() }).where(eq(media.id, id))
  const upserts = localizations.map((localization) => {
    const values = Object.fromEntries(Object.entries(localization).filter(([, value]) => value !== undefined)) as LocalizationInput
    return db.insert(mediaLocalizations).values({ mediaId: id, ...values })
      .onConflictDoUpdate({ target: [mediaLocalizations.mediaId, mediaLocalizations.locale], set: { ...values, updatedAt: new Date() } })
  })
  await db.batch([update, ...upserts])
}

export async function listUsages(db: Db, mediaId: string) {
  return db.select({ entityType: mediaUsages.entityType, entityId: mediaUsages.entityId, locale: mediaUsages.locale, context: mediaUsages.context })
    .from(mediaUsages).where(eq(mediaUsages.mediaId, mediaId))
}

export async function insertUsage(db: Db, usage: { mediaId: string, entityType: string, entityId: string, locale?: Locale | null, context: MediaUsageContext }): Promise<void> {
  await db.insert(mediaUsages).values(usage)
}

/** Soft delete; false if it was already deleted */
export async function softDeleteMedia(db: Db, id: string, userId: string): Promise<boolean> {
  const deleted = await db.update(media)
    .set({ status: 'deleted', deletedAt: new Date(), updatedBy: userId, updatedAt: new Date() })
    .where(and(eq(media.id, id), ne(media.status, 'deleted')))
    .returning({ id: media.id })
  return deleted.length > 0
}

export async function listLocalizations(db: Db, mediaId: string) {
  return db.select({
    locale: mediaLocalizations.locale,
    alt: mediaLocalizations.alt,
    caption: mediaLocalizations.caption,
    credit: mediaLocalizations.credit,
    translationState: mediaLocalizations.translationState,
  }).from(mediaLocalizations).where(eq(mediaLocalizations.mediaId, mediaId))
}

export interface MediaFilters {
  kind?: MediaKind | undefined
  status?: Exclude<MediaStatus, 'deleted'> | undefined
  /** Substring of the original file name */
  search?: string | undefined
  /** Informative images without a pt-BR alt */
  missingAlt?: boolean | undefined
  /** Uploaded at or after */
  from?: Date | undefined
  /** Uploaded before (exclusive) */
  to?: Date | undefined
  /** Id of the last item already shown; ids are UUIDv7, so they sort by time */
  before?: string | undefined
}

/** LIKE treats % and _ as wildcards; the search is a plain substring */
export async function listMedia(db: Db, filters: MediaFilters, limit: number) {
  const sourceAlt = db.select({ one: sql`1` }).from(mediaLocalizations).where(and(
    eq(mediaLocalizations.mediaId, media.id),
    eq(mediaLocalizations.locale, SOURCE_LOCALE),
    ne(mediaLocalizations.alt, ''),
  ))
  const conditions: SQL[] = [ne(media.status, 'deleted')]
  if (filters.kind) {
    conditions.push(eq(media.kind, filters.kind))
  }
  if (filters.status) {
    conditions.push(eq(media.status, filters.status))
  }
  if (filters.search) {
    // A literal substring, ASCII case ignored like LIKE did; instr() has no pattern, so no wildcard escaping and no
    // limit (D1 refuses LIKE patterns over 50 bytes, and searches go up to 100 characters)
    conditions.push(sql`instr(lower(${media.originalFilename}), lower(${filters.search})) > 0`)
  }
  if (filters.missingAlt) {
    conditions.push(eq(media.kind, 'image'), eq(media.decorative, false), notExists(sourceAlt))
  }
  if (filters.from) {
    conditions.push(gte(media.createdAt, filters.from))
  }
  if (filters.to) {
    conditions.push(lt(media.createdAt, filters.to))
  }
  if (filters.before) {
    conditions.push(lt(media.id, filters.before))
  }
  return db.select({
    id: media.id,
    kind: media.kind,
    status: media.status,
    mimeType: media.mimeType,
    originalFilename: media.originalFilename,
    sizeBytes: media.sizeBytes,
    width: media.width,
    height: media.height,
    placeholderDataUrl: media.placeholderDataUrl,
    dominantColor: media.dominantColor,
    decorative: media.decorative,
    variants: media.variants,
    hasSourceAlt: sql<number>`${exists(sourceAlt)}`,
    createdAt: media.createdAt,
  }).from(media).where(and(...conditions)).orderBy(desc(media.id)).limit(limit)
}

/** Ready images, for checking a video's poster */
export async function findReadyImage(db: Db, id: string): Promise<boolean> {
  const [row] = await db.select({ id: media.id }).from(media)
    .where(and(eq(media.id, id), eq(media.kind, 'image'), eq(media.status, 'ready')))
  return row !== undefined
}

/** Ready rows among `ids`, with their localizations and tracks: a single D1 batch whatever the count */
export async function findReadyMediaWithText(db: Db, ids: readonly string[]) {
  const unique = [...new Set(ids)]
  if (unique.length === 0) {
    return { rows: [], localizations: [], tracks: [] }
  }
  const groups = chunked(unique)
  const queries = groups.flatMap(group => [
    db.select().from(media).where(and(inArray(media.id, group), eq(media.status, 'ready'))),
    db.select({ mediaId: mediaLocalizations.mediaId, locale: mediaLocalizations.locale, alt: mediaLocalizations.alt, caption: mediaLocalizations.caption, credit: mediaLocalizations.credit })
      .from(mediaLocalizations).where(inArray(mediaLocalizations.mediaId, group)),
    db.select({ mediaId: mediaTracks.mediaId, locale: mediaTracks.locale, kind: mediaTracks.kind, label: mediaTracks.label, key: mediaTracks.key })
      .from(mediaTracks).where(inArray(mediaTracks.mediaId, group)).orderBy(mediaTracks.locale, mediaTracks.kind),
  ] as const)
  const results = await db.batch(queries as unknown as [typeof queries[number], ...typeof queries[number][]]) as unknown[][]
  const at = <T>(offset: number) => results.filter((_, index) => index % 3 === offset).flat() as T[]
  return {
    rows: at<MediaRow>(0),
    localizations: at<{ mediaId: string, locale: Locale, alt: string, caption: string | null, credit: string | null }>(1),
    tracks: at<{ mediaId: string, locale: Locale, kind: MediaTrackKind, label: string, key: string }>(2),
  }
}

/** Kind and status of the items among `ids` that are not deleted, for checks before saving content (F06-T1) */
export async function findMediaStates(db: Db, ids: readonly string[]): Promise<Map<string, { kind: MediaKind, status: MediaStatus }>> {
  const unique = [...new Set(ids)]
  const found = new Map<string, { kind: MediaKind, status: MediaStatus }>()
  for (const group of chunked(unique)) {
    const rows = await db.select({ id: media.id, kind: media.kind, status: media.status }).from(media)
      .where(and(inArray(media.id, group), ne(media.status, 'deleted')))
    for (const row of rows) {
      found.set(row.id, { kind: row.kind, status: row.status })
    }
  }
  return found
}
