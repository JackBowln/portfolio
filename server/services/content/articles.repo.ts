// Article queries for the admin (F06-T1, data-model §4.1–4.2): the entity with its working copies, the filtered
// list, and the writes the service composes into one D1 batch. Soft-deleted rows are hidden everywhere here
import { and, desc, eq, exists, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Locale, MediaUsageContext, PublicationStatus, TranslationState } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { users } from '../../db/schema/auth.ts'
import { articleLocalizations, articles } from '../../db/schema/content.ts'
import { mediaUsages } from '../../db/schema/media.ts'
import type { PreparedRevision } from './revisions.repo.ts'
import { insertRevisionStatement } from './revisions.repo.ts'

export type ArticleRow = typeof articles.$inferSelect
export type ArticleLocalizationRow = typeof articleLocalizations.$inferSelect

export async function findArticle(db: Db, id: string): Promise<(ArticleRow & { authorName: string | null }) | undefined> {
  const [row] = await db.select({ article: articles, authorName: users.name }).from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(and(eq(articles.id, id), isNull(articles.deletedAt)))
  return row ? { ...row.article, authorName: row.authorName } : undefined
}

export async function findArticleLocalizations(db: Db, articleIds: readonly string[]): Promise<ArticleLocalizationRow[]> {
  if (articleIds.length === 0) {
    return []
  }
  return db.select().from(articleLocalizations)
    .where(and(inArray(articleLocalizations.articleId, [...articleIds]), isNull(articleLocalizations.deletedAt)))
    .orderBy(articleLocalizations.locale)
}

/**
 * Slugs of a locale equal to `base` or starting with `base-`, to pick a free one when creating. A range instead of
 * LIKE: D1 refuses LIKE patterns longer than 50 bytes, and "-" is followed by "." in ASCII
 */
export async function takenSlugs(db: Db, locale: Locale, base: string): Promise<Set<string>> {
  const slug = articleLocalizations.slug
  const rows = await db.select({ slug }).from(articleLocalizations)
    .where(and(eq(articleLocalizations.locale, locale), isNull(articleLocalizations.deletedAt), or(eq(slug, base), and(gt(slug, `${base}-`), lt(slug, `${base}.`)))))
  return new Set(rows.map(row => row.slug))
}

export async function isSlugTaken(db: Db, locale: Locale, slug: string, exceptLocalizationId: string): Promise<boolean> {
  const [row] = await db.select({ id: articleLocalizations.id }).from(articleLocalizations)
    .where(and(eq(articleLocalizations.locale, locale), eq(articleLocalizations.slug, slug), isNull(articleLocalizations.deletedAt), sql`${articleLocalizations.id} <> ${exceptLocalizationId}`))
  return row !== undefined
}

export interface ArticleFilters {
  status?: PublicationStatus | undefined
  locale?: Locale | undefined
  translationState?: TranslationState | undefined
}

export interface ArticleListCursor {
  updatedAt: number
  id: string
}

/** Newest change first; an article matches when one of its localizations matches every filter */
export async function listArticles(db: Db, filters: ArticleFilters, cursor: ArticleListCursor | undefined, limit: number) {
  const conditions: SQL[] = [isNull(articles.deletedAt)]
  const localized: SQL[] = []
  if (filters.status) {
    localized.push(eq(articleLocalizations.status, filters.status))
  }
  if (filters.locale) {
    localized.push(eq(articleLocalizations.locale, filters.locale))
  }
  if (filters.translationState) {
    localized.push(eq(articleLocalizations.translationState, filters.translationState))
  }
  if (localized.length > 0) {
    conditions.push(exists(db.select({ one: sql`1` }).from(articleLocalizations)
      .where(and(eq(articleLocalizations.articleId, articles.id), isNull(articleLocalizations.deletedAt), ...localized))))
  }
  if (cursor) {
    const at = new Date(cursor.updatedAt)
    conditions.push(or(lt(articles.updatedAt, at), and(eq(articles.updatedAt, at), lt(articles.id, cursor.id)))!)
  }
  return db.select({ article: articles, authorName: users.name }).from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(and(...conditions))
    .orderBy(desc(articles.updatedAt), desc(articles.id))
    .limit(limit + 1)
}

/** Insert statements for a new article and its pt-BR working copy, for the caller's batch */
export function insertArticleStatements(db: Db, article: typeof articles.$inferInsert, localization: typeof articleLocalizations.$inferInsert) {
  return [db.insert(articles).values(article), db.insert(articleLocalizations).values(localization)] as const
}

/** SQL true while the localization still has this version: a write based on it is not stale */
export function copyAtVersion(db: Db, localizationId: string, version: number): SQL {
  return exists(db.select({ one: sql`1` }).from(articleLocalizations)
    .where(and(eq(articleLocalizations.id, localizationId), eq(articleLocalizations.version, version), isNull(articleLocalizations.deletedAt))))
}

export interface ArticleSave {
  articleId: string
  localizationId: string
  /** The version the editor read */
  version: number
  workingHash: string
  localization: Partial<typeof articleLocalizations.$inferInsert>
  entity: Partial<typeof articles.$inferInsert>
  uses: { mediaId: string, locale: Locale | null, context: MediaUsageContext }[]
  /** The revision this save records (autosave or restore, F06-T2), under the same guard */
  revision?: PreparedRevision | undefined
}

/**
 * One save as a batch: the working copy update guarded by the version (it changes no row when someone saved in
 * between), then the entity and the media uses (replaced as a whole, data-model §5), each guarded by "the working
 * copy now has version + 1 and this content", so a stale save changes nothing; the revision of the save too, when
 * given. The first result is the updated localization, empty on a conflict
 */
export function saveArticleStatements(db: Db, save: ArticleSave) {
  const saved = exists(db.select({ one: sql`1` }).from(articleLocalizations).where(and(
    eq(articleLocalizations.id, save.localizationId),
    eq(articleLocalizations.version, save.version + 1),
    eq(articleLocalizations.workingHash, save.workingHash),
  )))
  return [
    db.update(articleLocalizations).set({ ...save.localization, workingHash: save.workingHash, version: save.version + 1 })
      .where(and(eq(articleLocalizations.id, save.localizationId), eq(articleLocalizations.version, save.version), isNull(articleLocalizations.deletedAt)))
      .returning({ id: articleLocalizations.id }),
    db.update(articles).set(save.entity).where(and(eq(articles.id, save.articleId), saved)),
    db.delete(mediaUsages).where(and(eq(mediaUsages.entityType, 'article'), eq(mediaUsages.entityId, save.articleId), saved)),
    // Every use in one statement, read from a JSON parameter
    db.insert(mediaUsages).select(db.select({
      mediaId: sql<string>`json_extract(value, '$.mediaId')`.as('media_id'),
      entityType: sql<string>`'article'`.as('entity_type'),
      entityId: sql<string>`${save.articleId}`.as('entity_id'),
      locale: sql<Locale | null>`json_extract(value, '$.locale')`.as('locale'),
      context: sql<MediaUsageContext>`json_extract(value, '$.context')`.as('context'),
    }).from(sql`json_each(${JSON.stringify(save.uses)})`).where(saved)),
    ...(save.revision ? [insertRevisionStatement(db, 'article', save.revision, saved)] : []),
  ] as const
}

export function softDeleteStatements(db: Db, articleId: string, userId: string) {
  const at = new Date()
  return [
    db.update(articles).set({ deletedAt: at, updatedBy: userId }).where(eq(articles.id, articleId)),
    db.update(articleLocalizations).set({ deletedAt: at, updatedBy: userId }).where(eq(articleLocalizations.articleId, articleId)),
    db.delete(mediaUsages).where(and(eq(mediaUsages.entityType, 'article'), eq(mediaUsages.entityId, articleId))),
  ] as const
}
