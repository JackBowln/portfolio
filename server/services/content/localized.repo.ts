// Localization queries shared by articles, projects and pages (data-model §4, §10). Public reads touch only the
// published_* columns and published_snapshot, never the working copy (invariant §9.3), and soft-deleted rows or
// entities are hidden everywhere here
import { and, desc, eq, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { contentHash } from '../../../shared/content/canonical-json.ts'
import type { PublishedCursor } from '../../../shared/content/cursor.ts'
import { encodePublishedCursor } from '../../../shared/content/cursor.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import type { ContentType, Snapshot, SnapshotEntity, SluggedContentType } from '../../../shared/content/snapshot.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { contentTables, publishedLead } from './content-tables.ts'
import type { ContentTables } from './content-tables.ts'

export type LocalizationRow<T extends ContentType> = ContentTables[T]['localizations']['$inferSelect']
export type NewLocalization<T extends ContentType> = Omit<ContentTables[T]['localizations']['$inferInsert'], 'workingHash'>

// The three tables differ only in their entity key, so queries are written against one of them; the casts stay here
const tablesOf = (type: ContentType) => contentTables[type] as unknown as ContentTables['article']
const sluggedTablesOf = (type: SluggedContentType) => contentTables[type] as ContentTables[SluggedContentType]

/**
 * Inserts a working copy. `working_hash` is the hash of its snapshot with the entity fields given here (cover,
 * tags…), the same hash a revision of this content gets
 */
export async function createLocalization<T extends ContentType>(db: Db, type: T, values: NewLocalization<T>, entity: SnapshotEntity<T>): Promise<LocalizationRow<T>> {
  const { localizations } = tablesOf(type)
  const workingHash = await contentHash(snapshotOf(type, entity, values))
  const [row] = await db.insert(localizations).values({ ...values, workingHash } as never).returning()
  return row as LocalizationRow<T>
}

export async function getLocalization<T extends ContentType>(db: Db, type: T, entityId: string, locale: Locale): Promise<LocalizationRow<T> | undefined> {
  const { localizations, localizationEntityId } = tablesOf(type)
  const [row] = await db.select().from(localizations)
    .where(and(eq(localizationEntityId, entityId), eq(localizations.locale, locale), isNull(localizations.deletedAt)))
  return row as LocalizationRow<T> | undefined
}

export interface PublishedLocalization<T extends SluggedContentType> {
  id: string
  entityId: string
  locale: Locale
  publishedRevisionId: string
  publishedAt: Date
  snapshot: Snapshot<T>
}

/** The public detail read: one query on the (locale, published_slug) unique index, joined to the live entity */
export async function getPublishedBySlug<T extends SluggedContentType>(db: Db, type: T, locale: Locale, slug: string): Promise<PublishedLocalization<T> | undefined> {
  const { entity, localizations, localizationEntityId } = sluggedTablesOf(type)
  const [row] = await db.select({
    id: localizations.id,
    entityId: localizationEntityId,
    locale: localizations.locale,
    publishedRevisionId: localizations.publishedRevisionId,
    publishedAt: localizations.publishedAt,
    snapshot: localizations.publishedSnapshot,
  }).from(localizations)
    .innerJoin(entity, eq(entity.id, localizationEntityId))
    .where(and(
      eq(localizations.locale, locale),
      eq(localizations.publishedSlug, slug),
      isNotNull(localizations.publishedRevisionId),
      isNull(localizations.deletedAt),
      isNull(entity.deletedAt),
    ))
  return row as PublishedLocalization<T> | undefined
}

/** Locales in which the entity is published, for hreflang and the language switcher */
export async function listPublishedAlternates(db: Db, type: SluggedContentType, entityId: string): Promise<{ locale: Locale, slug: string }[]> {
  const { localizations, localizationEntityId } = sluggedTablesOf(type)
  const rows = await db.select({ locale: localizations.locale, slug: localizations.publishedSlug }).from(localizations)
    .where(and(eq(localizationEntityId, entityId), isNotNull(localizations.publishedRevisionId), isNull(localizations.deletedAt)))
    .orderBy(localizations.locale)
  return rows as { locale: Locale, slug: string }[]
}

export interface PublishedListItem {
  id: string
  entityId: string
  slug: string
  title: string
  lead: string
  coverMediaId: string | null
  readingTimeMin: number | null
  publishedAt: Date
}

/** A public list page, newest first, by keyset on (published_at, id) */
export async function listPublished(db: Db, type: SluggedContentType, locale: Locale, { cursor, limit }: { cursor?: PublishedCursor | undefined, limit: number }): Promise<{ items: PublishedListItem[], nextCursor: string | null }> {
  const { entity, localizations, localizationEntityId } = sluggedTablesOf(type)
  const after = cursor && or(
    lt(localizations.publishedAt, new Date(cursor.publishedAt)),
    and(eq(localizations.publishedAt, new Date(cursor.publishedAt)), lt(localizations.id, cursor.id)),
  )
  const rows = await db.select({
    id: localizations.id,
    entityId: localizationEntityId,
    slug: localizations.publishedSlug,
    title: localizations.publishedTitle,
    lead: publishedLead[type],
    coverMediaId: localizations.publishedCoverMediaId,
    readingTimeMin: localizations.publishedReadingTimeMin,
    publishedAt: localizations.publishedAt,
  }).from(localizations)
    .innerJoin(entity, eq(entity.id, localizationEntityId))
    .where(and(
      eq(localizations.locale, locale),
      isNotNull(localizations.publishedRevisionId),
      isNull(localizations.deletedAt),
      isNull(entity.deletedAt),
      after,
    ))
    .orderBy(desc(localizations.publishedAt), desc(localizations.id))
    .limit(limit + 1)
  const items = rows.slice(0, limit) as PublishedListItem[]
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > limit && last ? encodePublishedCursor({ publishedAt: last.publishedAt.getTime(), id: last.id }) : null,
  }
}
