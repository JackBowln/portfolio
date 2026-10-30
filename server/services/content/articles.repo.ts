// Article queries for the admin (F06-T1, data-model §4.1–4.2): the entity, the filtered list and the insert of a new
// article. Working copies and saves are shared with projects (working-copy.repo.ts). Soft-deleted rows are hidden
import { and, desc, eq, exists, isNull, lt, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Locale, PublicationStatus, TranslationState } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { users } from '../../db/schema/auth.ts'
import { articleLocalizations, articles } from '../../db/schema/content.ts'
import type { ListCursor } from './working-copy.ts'

export type ArticleRow = typeof articles.$inferSelect
export type ArticleLocalizationRow = typeof articleLocalizations.$inferSelect

export async function findArticle(db: Db, id: string): Promise<(ArticleRow & { authorName: string | null }) | undefined> {
  const [row] = await db.select({ article: articles, authorName: users.name }).from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(and(eq(articles.id, id), isNull(articles.deletedAt)))
  return row ? { ...row.article, authorName: row.authorName } : undefined
}

export interface ArticleFilters {
  status?: PublicationStatus | undefined
  locale?: Locale | undefined
  translationState?: TranslationState | undefined
}

/** Newest change first; an article matches when one of its localizations matches every filter */
export async function listArticles(db: Db, filters: ArticleFilters, cursor: ListCursor | undefined, limit: number) {
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
