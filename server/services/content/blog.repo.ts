// Public blog reads (F06-T5, data-model §10): only the published_* columns and published_snapshot, never the working
// copy (invariant §9.3), and only live entities. Lists are ordered by the article's first publication, so publishing
// a correction does not move an old article to the top
import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Snapshot } from '../../../shared/content/snapshot.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { articleLocalizations, articles, articleTags } from '../../db/schema/content.ts'
import { tagLocalizations } from '../../db/schema/taxonomy.ts'
import { publishedIndexable } from './localized.repo.ts'

const live = (locale: Locale): SQL => and(
  eq(articleLocalizations.locale, locale),
  isNotNull(articleLocalizations.publishedRevisionId),
  isNull(articleLocalizations.deletedAt),
  isNull(articles.deletedAt),
)!

export interface BlogListItem {
  articleId: string
  slug: string
  title: string
  excerpt: string
  coverMediaId: string | null
  readingTimeMin: number | null
  firstPublishedAt: Date
  publishedAt: Date
}

const listColumns = {
  articleId: articles.id,
  slug: sql<string>`${articleLocalizations.publishedSlug}`,
  title: sql<string>`${articleLocalizations.publishedTitle}`,
  excerpt: sql<string>`coalesce(${articleLocalizations.publishedExcerpt}, '')`,
  coverMediaId: articleLocalizations.publishedCoverMediaId,
  readingTimeMin: articleLocalizations.publishedReadingTimeMin,
  // An article published before first_published_at existed falls back to its version's date
  firstPublishedAt: sql<number>`coalesce(${articles.firstPublishedAt}, ${articleLocalizations.publishedAt})`.mapWith(value => new Date(Number(value))),
  publishedAt: sql<number>`${articleLocalizations.publishedAt}`.mapWith(value => new Date(Number(value))),
}

/** One page of the locale's articles, newest first, with the total; `tagId` narrows to a topic */
export async function listBlogPage(db: Db, locale: Locale, { offset, limit, tagId }: { offset: number, limit: number, tagId?: string | undefined }): Promise<{ items: BlogListItem[], total: number }> {
  const topic = tagId ? sql`EXISTS (SELECT 1 FROM ${articleTags} WHERE ${articleTags.articleId} = ${articles.id} AND ${articleTags.tagId} = ${tagId})` : undefined
  const rows = await db.select({ ...listColumns, total: sql<number>`count(*) OVER ()`.mapWith(Number) })
    .from(articleLocalizations)
    .innerJoin(articles, eq(articles.id, articleLocalizations.articleId))
    .where(and(live(locale), topic))
    .orderBy(desc(sql`coalesce(${articles.firstPublishedAt}, ${articleLocalizations.publishedAt})`), desc(articles.id))
    .limit(limit)
    .offset(offset)
  return { items: rows.map(({ total: _total, ...item }) => item), total: rows[0]?.total ?? (offset > 0 ? await countBlog(db, locale, tagId) : 0) }
}

/** The total alone, for a page past the end (which has no rows to carry it) */
async function countBlog(db: Db, locale: Locale, tagId?: string): Promise<number> {
  const topic = tagId ? sql`EXISTS (SELECT 1 FROM ${articleTags} WHERE ${articleTags.articleId} = ${articles.id} AND ${articleTags.tagId} = ${tagId})` : undefined
  const [row] = await db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(articleLocalizations)
    .innerJoin(articles, eq(articles.id, articleLocalizations.articleId))
    .where(and(live(locale), topic))
  return row?.total ?? 0
}

export interface PublishedArticle {
  articleId: string
  localizationId: string
  firstPublishedAt: Date
  publishedAt: Date
  snapshot: Snapshot<'article'>
  readingTimeMin: number
}

/** The article published at (locale, slug): one query on the published-slug index */
export async function findPublishedArticle(db: Db, locale: Locale, slug: string): Promise<PublishedArticle | undefined> {
  const [row] = await db.select({
    articleId: articles.id,
    localizationId: articleLocalizations.id,
    firstPublishedAt: listColumns.firstPublishedAt,
    publishedAt: listColumns.publishedAt,
    snapshot: articleLocalizations.publishedSnapshot,
    readingTimeMin: sql<number>`coalesce(${articleLocalizations.publishedReadingTimeMin}, 0)`.mapWith(Number),
  }).from(articleLocalizations)
    .innerJoin(articles, eq(articles.id, articleLocalizations.articleId))
    .where(and(live(locale), eq(articleLocalizations.publishedSlug, slug)))
  return row ? { ...row, snapshot: row.snapshot! } : undefined
}

// F09-T1: a topic exists in a locale only with its original or an approved name (i18n-seo §3)
const namedIn = (locale: Locale): SQL => and(eq(tagLocalizations.locale, locale), inArray(tagLocalizations.translationState, ['source', 'approved']))!

/** Topics with a name in the locale, in the given order */
export async function topicsIn(db: Db, locale: Locale, tagIds: readonly string[]): Promise<{ id: string, name: string, slug: string }[]> {
  if (tagIds.length === 0) {
    return []
  }
  const rows = await db.select({ id: tagLocalizations.tagId, name: tagLocalizations.name, slug: tagLocalizations.slug }).from(tagLocalizations)
    .where(and(namedIn(locale), inArray(tagLocalizations.tagId, [...tagIds])))
  return tagIds.flatMap(id => rows.filter(row => row.id === id))
}

/** Other articles of the locale that share a published topic, newest first */
export async function relatedArticles(db: Db, locale: Locale, articleId: string, limit: number): Promise<BlogListItem[]> {
  const shared = sql`EXISTS (SELECT 1 FROM ${articleTags} mine JOIN ${articleTags} theirs ON theirs.tag_id = mine.tag_id
    WHERE mine.article_id = ${articleId} AND theirs.article_id = ${articles.id})`
  return db.select(listColumns).from(articleLocalizations)
    .innerJoin(articles, eq(articles.id, articleLocalizations.articleId))
    .where(and(live(locale), ne(articles.id, articleId), shared))
    .orderBy(desc(sql`coalesce(${articles.firstPublishedAt}, ${articleLocalizations.publishedAt})`), desc(articles.id))
    .limit(limit)
}

/** The topic at (locale, slug), if it has a name in the locale */
export async function findTopic(db: Db, locale: Locale, slug: string): Promise<{ id: string, name: string, slug: string } | undefined> {
  const [row] = await db.select({ id: tagLocalizations.tagId, name: tagLocalizations.name, slug: tagLocalizations.slug }).from(tagLocalizations)
    .where(and(namedIn(locale), eq(tagLocalizations.slug, slug)))
  return row
}

/** Topics named in the locale with at least one article published in it, with the count, by name */
export async function topicsWithArticles(db: Db, locale: Locale): Promise<{ id: string, name: string, slug: string, count: number }[]> {
  return db.select({ id: tagLocalizations.tagId, name: tagLocalizations.name, slug: tagLocalizations.slug, count: sql<number>`count(DISTINCT ${articles.id})`.mapWith(Number) })
    .from(tagLocalizations)
    .innerJoin(articleTags, eq(articleTags.tagId, tagLocalizations.tagId))
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .innerJoin(articleLocalizations, eq(articleLocalizations.articleId, articles.id))
    .where(and(namedIn(locale), live(locale)))
    .groupBy(tagLocalizations.tagId, tagLocalizations.name, tagLocalizations.slug)
    .orderBy(tagLocalizations.name)
}

/** Every published article localization, for the sitemap: one row per (article, locale) */
export async function allPublishedArticles(db: Db): Promise<{ articleId: string, locale: Locale, slug: string, publishedAt: Date }[]> {
  return db.select({
    articleId: articles.id,
    locale: articleLocalizations.locale,
    slug: sql<string>`${articleLocalizations.publishedSlug}`,
    publishedAt: listColumns.publishedAt,
  }).from(articleLocalizations)
    .innerJoin(articles, eq(articles.id, articleLocalizations.articleId))
    .where(and(isNotNull(articleLocalizations.publishedRevisionId), isNull(articleLocalizations.deletedAt), isNull(articles.deletedAt), publishedIndexable(articleLocalizations.publishedSnapshot)))
    .orderBy(articles.id, articleLocalizations.locale)
}

/**
 * Topics with a name and at least one published article per locale (F11-T3), with the newest of those articles: the
 * sitemap's topic pages, and a topic page's alternates when `tagId` is given
 */
export async function publishedTopics(db: Db, tagId?: string): Promise<{ tagId: string, locale: Locale, slug: string, publishedAt: Date }[]> {
  return db.select({
    tagId: tagLocalizations.tagId,
    locale: tagLocalizations.locale,
    slug: tagLocalizations.slug,
    publishedAt: sql<number>`max(${articleLocalizations.publishedAt})`.mapWith(value => new Date(Number(value))),
  }).from(tagLocalizations)
    .innerJoin(articleTags, eq(articleTags.tagId, tagLocalizations.tagId))
    .innerJoin(articles, eq(articles.id, articleTags.articleId))
    .innerJoin(articleLocalizations, and(eq(articleLocalizations.articleId, articles.id), eq(articleLocalizations.locale, tagLocalizations.locale)))
    .where(and(
      inArray(tagLocalizations.translationState, ['source', 'approved']),
      isNotNull(articleLocalizations.publishedRevisionId),
      isNull(articleLocalizations.deletedAt),
      isNull(articles.deletedAt),
      ...(tagId ? [eq(tagLocalizations.tagId, tagId)] : []),
    ))
    .groupBy(tagLocalizations.tagId, tagLocalizations.locale, tagLocalizations.slug)
    .orderBy(tagLocalizations.tagId, tagLocalizations.locale) as Promise<{ tagId: string, locale: Locale, slug: string, publishedAt: Date }[]>
}
