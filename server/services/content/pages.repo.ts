// Institutional pages (F08-T2, data-model §4.6): fixed keys, no slug, blocks instead of a body. A page and its pt-BR
// working copy are created the first time they are needed, idempotently. Saves and publishing follow the articles' guarded
// batches (publishing.repo.ts): the localization moves only from the version (and status) read, and every later
// statement runs only once that move happened
import { and, eq, exists, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Snapshot } from '../../../shared/content/snapshot.ts'
import type { Locale, MediaUsageContext, PageKey, PublicationStatus } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { pageLocalizations, pages } from '../../db/schema/content.ts'
import { mediaUsages } from '../../db/schema/media.ts'
import type { AuditRow } from '../audit/audit.repo.ts'
import { auditEntryStatement } from '../audit/audit.repo.ts'
import type { PreparedRevision } from './revisions.repo.ts'
import { insertRevisionStatement } from './revisions.repo.ts'
import type { MediaUse } from './working-copy.repo.ts'

export type PageRow = typeof pages.$inferSelect
export type PageLocalizationRow = typeof pageLocalizations.$inferSelect

export async function findPage(db: Db, key: PageKey): Promise<PageRow | undefined> {
  const [row] = await db.select().from(pages).where(eq(pages.key, key))
  return row
}

export async function findPageLocalizations(db: Db, pageIds: readonly string[]): Promise<PageLocalizationRow[]> {
  if (pageIds.length === 0) {
    return []
  }
  return db.select().from(pageLocalizations)
    .where(and(inArray(pageLocalizations.pageId, [...pageIds]), isNull(pageLocalizations.deletedAt)))
    .orderBy(pageLocalizations.locale)
}

/** The page row, if it was never created; idempotent (the key is unique) */
export async function insertPage(db: Db, id: string, key: PageKey): Promise<void> {
  await db.insert(pages).values({ id, key }).onConflictDoNothing()
}

/** A localization of a page, if it has none in that locale yet; idempotent (unique page and locale) */
export async function insertPageLocalization(db: Db, localization: typeof pageLocalizations.$inferInsert): Promise<void> {
  await db.insert(pageLocalizations).values(localization).onConflictDoNothing()
}

export interface PageSave {
  pageId: string
  localizationId: string
  version: number
  workingHash: string
  localization: Record<string, unknown>
  uses: MediaUse[]
  revision?: PreparedRevision | undefined
}

/** One save: the copy guarded by the version, then the media uses and the revision once it took effect */
export function savePageStatements(db: Db, save: PageSave) {
  const saved = exists(db.select({ one: sql`1` }).from(pageLocalizations).where(and(
    eq(pageLocalizations.id, save.localizationId),
    eq(pageLocalizations.version, save.version + 1),
    eq(pageLocalizations.workingHash, save.workingHash),
  )))
  return [
    db.update(pageLocalizations).set({ ...save.localization, workingHash: save.workingHash, version: save.version + 1 })
      .where(and(eq(pageLocalizations.id, save.localizationId), eq(pageLocalizations.version, save.version), isNull(pageLocalizations.deletedAt)))
      .returning({ id: pageLocalizations.id }),
    db.delete(mediaUsages).where(and(eq(mediaUsages.entityType, 'page'), eq(mediaUsages.entityId, save.pageId), saved)),
    db.insert(mediaUsages).select(db.select({
      mediaId: sql<string>`json_extract(value, '$.mediaId')`.as('media_id'),
      entityType: sql<string>`'page'`.as('entity_type'),
      entityId: sql<string>`${save.pageId}`.as('entity_id'),
      locale: sql<Locale | null>`json_extract(value, '$.locale')`.as('locale'),
      context: sql<MediaUsageContext>`json_extract(value, '$.context')`.as('context'),
    }).from(sql`json_each(${JSON.stringify(save.uses)})`).where(saved)),
    ...(save.revision ? [insertRevisionStatement(db, 'page', save.revision, saved)] : []),
  ] as const
}

const copyIs = (db: Db, localizationId: string, version: number, statuses: readonly PublicationStatus[]): SQL => exists(db.select({ one: sql`1` }).from(pageLocalizations).where(and(
  eq(pageLocalizations.id, localizationId),
  eq(pageLocalizations.version, version),
  inArray(pageLocalizations.status, [...statuses]),
  isNull(pageLocalizations.deletedAt),
)))

export interface PagePublishWrite {
  localizationId: string
  version: number
  from: readonly PublicationStatus[]
  revision: PreparedRevision
  snapshot: Snapshot<'page'>
  now: Date
  audit: AuditRow
}

/** Revision first (the pointer has a foreign key to it), then the copy; the audit only once it points at the revision */
export function publishPageStatements(db: Db, write: PagePublishWrite) {
  const before = copyIs(db, write.localizationId, write.version, write.from)
  const done = exists(db.select({ one: sql`1` }).from(pageLocalizations)
    .where(and(eq(pageLocalizations.id, write.localizationId), eq(pageLocalizations.publishedRevisionId, write.revision.id))))
  return [
    insertRevisionStatement(db, 'page', write.revision, before),
    db.update(pageLocalizations).set({
      status: 'published',
      scheduledAt: null,
      publishedRevisionId: write.revision.id,
      publishedSnapshot: write.snapshot as never,
      publishedAt: write.now,
    }).where(and(eq(pageLocalizations.id, write.localizationId), before)).returning({ id: pageLocalizations.id }),
    auditEntryStatement(db, write.audit, done),
  ] as const
}

/** Takes localizations off the site (revisions stay); the first result lists what was unpublished */
export function unpublishPageStatements(db: Db, localizationIds: string[], audit: AuditRow) {
  const changed = exists(db.select({ one: sql`1` }).from(pageLocalizations)
    .where(and(inArray(pageLocalizations.id, localizationIds), eq(pageLocalizations.status, 'unpublished'), isNull(pageLocalizations.publishedRevisionId))))
  return [
    db.update(pageLocalizations).set({ status: 'unpublished', publishedRevisionId: null, publishedSnapshot: null, publishedAt: null })
      .where(and(inArray(pageLocalizations.id, localizationIds), isNotNull(pageLocalizations.publishedRevisionId)))
      .returning({ id: pageLocalizations.id, locale: pageLocalizations.locale }),
    auditEntryStatement(db, audit, changed),
  ] as const
}

/** Published localizations of the pages, for the sitemap and the public read */
export async function publishedPageLocales(db: Db, keys: readonly PageKey[]): Promise<{ key: PageKey, locale: Locale, publishedAt: Date }[]> {
  if (keys.length === 0) {
    return []
  }
  return db.select({ key: pages.key, locale: pageLocalizations.locale, publishedAt: sql<number>`${pageLocalizations.publishedAt}`.mapWith(value => new Date(Number(value))) })
    .from(pageLocalizations)
    .innerJoin(pages, eq(pages.id, pageLocalizations.pageId))
    .where(and(inArray(pages.key, [...keys]), isNotNull(pageLocalizations.publishedRevisionId), isNull(pageLocalizations.deletedAt)))
    .orderBy(pages.key, pageLocalizations.locale)
}
