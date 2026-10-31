// Working copies of slugged content (articles and projects, data-model §4.1–4.5): the reads and the writes the
// services compose into one D1 batch. The tables share their column groups (content-tables.ts), so each query is
// written once; soft-deleted rows are hidden everywhere here
import { and, eq, exists, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { ContentType, SluggedContentType } from '../../../shared/content/snapshot.ts'
import type { Locale, MediaUsageContext } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { chunked } from '../../db/in-limit.ts'
import { mediaUsages } from '../../db/schema/media.ts'
import { contentTables } from './content-tables.ts'
import type { ContentTables } from './content-tables.ts'
import type { LocalizationRow } from './localized.repo.ts'
import type { PreparedRevision } from './revisions.repo.ts'
import { insertRevisionStatement } from './revisions.repo.ts'

// The two tables differ only in their entity key (localizationEntityId); the casts stay here
const tablesOf = (type: ContentType) => contentTables[type] as unknown as ContentTables['article']

export interface MediaUse {
  mediaId: string
  locale: Locale | null
  context: MediaUsageContext
}

export async function findLocalizations<T extends SluggedContentType>(db: Db, type: T, entityIds: readonly string[]): Promise<LocalizationRow<T>[]> {
  if (entityIds.length === 0) {
    return []
  }
  const { localizations, localizationEntityId } = tablesOf(type)
  // A list of every project can pass D1's 100 bound parameters
  const groups = await Promise.all(chunked(entityIds).map(group => db.select().from(localizations)
    .where(and(inArray(localizationEntityId, group), isNull(localizations.deletedAt)))
    .orderBy(localizations.locale)))
  return groups.flat() as unknown as LocalizationRow<T>[]
}

/**
 * Slugs of a locale equal to `base` or starting with `base-`, to pick a free one when creating. A range instead of
 * LIKE: D1 refuses LIKE patterns longer than 50 bytes, and "-" is followed by "." in ASCII
 */
export async function takenSlugs(db: Db, type: SluggedContentType, locale: Locale, base: string): Promise<Set<string>> {
  const { localizations } = tablesOf(type)
  const slug = localizations.slug
  const rows = await db.select({ slug }).from(localizations)
    .where(and(eq(localizations.locale, locale), isNull(localizations.deletedAt), or(eq(slug, base), and(gt(slug, `${base}-`), lt(slug, `${base}.`)))))
  return new Set(rows.map(row => row.slug))
}

export async function isSlugTaken(db: Db, type: SluggedContentType, locale: Locale, slug: string, exceptLocalizationId: string): Promise<boolean> {
  const { localizations } = tablesOf(type)
  const [row] = await db.select({ id: localizations.id }).from(localizations)
    .where(and(eq(localizations.locale, locale), eq(localizations.slug, slug), isNull(localizations.deletedAt), sql`${localizations.id} <> ${exceptLocalizationId}`))
  return row !== undefined
}

/** SQL true while the localization still has this version: a write based on it is not stale */
export function copyAtVersion(db: Db, type: ContentType, localizationId: string, version: number): SQL {
  const { localizations } = tablesOf(type)
  return exists(db.select({ one: sql`1` }).from(localizations)
    .where(and(eq(localizations.id, localizationId), eq(localizations.version, version), isNull(localizations.deletedAt))))
}

export interface WorkingCopySave {
  entityId: string
  localizationId: string
  /** The version the editor read */
  version: number
  workingHash: string
  localization: Record<string, unknown>
  entity: Record<string, unknown>
  uses: MediaUse[]
  /** The revision this save records (autosave or restore, F06-T2), under the same guard */
  revision?: PreparedRevision | undefined
}

/**
 * One save as a batch: the working copy update guarded by the version (it changes no row when someone saved in
 * between), then the entity and the media uses (replaced as a whole, data-model §5), each guarded by "the working
 * copy now has version + 1 and this content", so a stale save changes nothing; the revision of the save too, when
 * given. The first result is the updated localization, empty on a conflict
 */
export function saveStatements(db: Db, type: SluggedContentType, save: WorkingCopySave) {
  const { entity, localizations } = tablesOf(type)
  const saved = exists(db.select({ one: sql`1` }).from(localizations).where(and(
    eq(localizations.id, save.localizationId),
    eq(localizations.version, save.version + 1),
    eq(localizations.workingHash, save.workingHash),
  )))
  return [
    db.update(localizations).set({ ...save.localization, workingHash: save.workingHash, version: save.version + 1 })
      .where(and(eq(localizations.id, save.localizationId), eq(localizations.version, save.version), isNull(localizations.deletedAt)))
      .returning({ id: localizations.id }),
    db.update(entity).set(save.entity).where(and(eq(entity.id, save.entityId), saved)),
    db.delete(mediaUsages).where(and(eq(mediaUsages.entityType, type), eq(mediaUsages.entityId, save.entityId), saved)),
    // Every use in one statement, read from a JSON parameter
    db.insert(mediaUsages).select(db.select({
      mediaId: sql<string>`json_extract(value, '$.mediaId')`.as('media_id'),
      entityType: sql<string>`${type}`.as('entity_type'),
      entityId: sql<string>`${save.entityId}`.as('entity_id'),
      locale: sql<Locale | null>`json_extract(value, '$.locale')`.as('locale'),
      context: sql<MediaUsageContext>`json_extract(value, '$.context')`.as('context'),
    }).from(sql`json_each(${JSON.stringify(save.uses)})`).where(saved)),
    ...(save.revision ? [insertRevisionStatement(db, type, save.revision, saved)] : []),
  ] as const
}

export function softDeleteStatements(db: Db, type: SluggedContentType, entityId: string, userId: string) {
  const { entity, localizations, localizationEntityId } = tablesOf(type)
  const at = new Date()
  return [
    db.update(entity).set({ deletedAt: at, updatedBy: userId }).where(eq(entity.id, entityId)),
    db.update(localizations).set({ deletedAt: at, updatedBy: userId }).where(eq(localizationEntityId, entityId)),
    db.delete(mediaUsages).where(and(eq(mediaUsages.entityType, type), eq(mediaUsages.entityId, entityId))),
  ] as const
}
