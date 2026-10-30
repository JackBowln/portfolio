// Publication writes (data-model §8–§9, F06-T4) as statements for one D1 batch each. A publish inserts the
// `publish` revision first (the localization's pointer has a foreign key to it), then moves the localization only
// while it still has the version and status read; every later statement runs only if the localization now points
// at this revision, so a stale or repeated publish changes nothing, and any failure rolls the whole batch back
import { and, asc, eq, exists, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Snapshot } from '../../../shared/content/snapshot.ts'
import type { Locale, PublicationStatus } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { articleLocalizations, articles, articleTags } from '../../db/schema/content.ts'
import { redirects } from '../../db/schema/system.ts'
import type { AuditRow } from '../audit/audit.repo.ts'
import { auditEntryStatement } from '../audit/audit.repo.ts'
import type { PreparedRevision } from './revisions.repo.ts'
import { insertRevisionStatement } from './revisions.repo.ts'

/** SQL true while the localization has this version and one of these statuses */
function copyIs(db: Db, localizationId: string, version: number, statuses: readonly PublicationStatus[]): SQL {
  return exists(db.select({ one: sql`1` }).from(articleLocalizations).where(and(
    eq(articleLocalizations.id, localizationId),
    eq(articleLocalizations.version, version),
    inArray(articleLocalizations.status, [...statuses]),
    isNull(articleLocalizations.deletedAt),
  )))
}

/** SQL true once the localization points at this revision: the publish took effect */
function pointsAt(db: Db, localizationId: string, revisionId: string): SQL {
  return exists(db.select({ one: sql`1` }).from(articleLocalizations)
    .where(and(eq(articleLocalizations.id, localizationId), eq(articleLocalizations.publishedRevisionId, revisionId))))
}

export interface PublishWrite {
  articleId: string
  localizationId: string
  locale: Locale
  version: number
  /** The statuses the localization may be in for this publish (the cron: scheduled only) */
  from: readonly PublicationStatus[]
  revision: PreparedRevision
  snapshot: Snapshot<'article'>
  readingTimeMin: number
  now: Date
  /** pt-BR only: rebuild article_tags from the draft topics */
  tagIds: string[] | null
  /** The old and new public paths when the published slug changes */
  redirect: { from: string, to: string, userId: string | null } | null
  audit: AuditRow
}

export function publishStatements(db: Db, write: PublishWrite) {
  const before = copyIs(db, write.localizationId, write.version, write.from)
  const done = pointsAt(db, write.localizationId, write.revision.id)
  const { localization, entity } = write.snapshot
  const tags = write.tagIds === null
    ? []
    : [
        db.delete(articleTags).where(and(eq(articleTags.articleId, write.articleId), done)),
        db.insert(articleTags).select(db.select({
          articleId: sql<string>`${write.articleId}`.as('article_id'),
          tagId: sql<string>`value`.as('tag_id'),
        }).from(sql`json_each(${JSON.stringify(write.tagIds)})`).where(and(done, sql`value IN (SELECT id FROM tags)`))),
      ]
  const redirect = write.redirect === null
    ? []
    : [
        // No chains: whatever pointed at the old path now points at the new one
        db.update(redirects).set({ toPath: write.redirect.to }).where(and(eq(redirects.toPath, write.redirect.from), done)),
        // No loops: going back to an old slug removes the redirect away from it
        db.delete(redirects).where(and(eq(redirects.fromPath, write.redirect.to), done)),
        db.insert(redirects).select(db.select({
          id: sql<string>`${uuidv7()}`.as('id'),
          fromPath: sql<string>`${write.redirect.from}`.as('from_path'),
          toPath: sql<string>`${write.redirect.to}`.as('to_path'),
          statusCode: sql<number>`301`.as('status_code'),
          locale: sql<Locale>`${write.locale}`.as('locale'),
          entityType: sql<string>`'article'`.as('entity_type'),
          entityId: sql<string>`${write.articleId}`.as('entity_id'),
          createdBy: sql<string | null>`${write.redirect.userId}`.as('created_by'),
          createdAt: sql<number>`${write.now.getTime()}`.as('created_at'),
        } as never).from(sql`(SELECT 1)`).where(done)).onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: write.redirect.to } }),
      ]
  return [
    insertRevisionStatement(db, 'article', write.revision, before),
    db.update(articleLocalizations).set({
      status: 'published',
      scheduledAt: null,
      publishedRevisionId: write.revision.id,
      publishedSnapshot: write.snapshot,
      publishedSlug: localization.slug,
      publishedTitle: localization.title,
      publishedExcerpt: localization.excerpt,
      publishedCoverMediaId: entity.coverMediaId,
      publishedReadingTimeMin: write.readingTimeMin,
      publishedAt: write.now,
    }).where(and(eq(articleLocalizations.id, write.localizationId), before)).returning({ id: articleLocalizations.id }),
    db.update(articles).set({ firstPublishedAt: sql`coalesce(${articles.firstPublishedAt}, ${write.now.getTime()})` })
      .where(and(eq(articles.id, write.articleId), done)),
    ...tags,
    ...redirect,
    auditEntryStatement(db, write.audit, done),
  ] as const
}

const UNPUBLISHED = {
  status: 'unpublished' as const,
  publishedRevisionId: null,
  publishedSnapshot: null,
  publishedSlug: null,
  publishedTitle: null,
  publishedExcerpt: null,
  publishedCoverMediaId: null,
  publishedReadingTimeMin: null,
  publishedAt: null,
}

/**
 * Takes localizations off the site (revisions stay). `localizationIds` are the localization and, for pt-BR, every
 * published translation (decision 4). The first result lists what was unpublished
 */
export function unpublishStatements(db: Db, articleId: string, localizationIds: string[], sourceIncluded: boolean, audit: AuditRow) {
  const target = and(inArray(articleLocalizations.id, localizationIds), isNotNull(articleLocalizations.publishedRevisionId))
  const changed = exists(db.select({ one: sql`1` }).from(articleLocalizations)
    .where(and(inArray(articleLocalizations.id, localizationIds), eq(articleLocalizations.status, 'unpublished'), isNull(articleLocalizations.publishedRevisionId))))
  return [
    db.update(articleLocalizations).set(UNPUBLISHED).where(target).returning({ id: articleLocalizations.id, locale: articleLocalizations.locale }),
    ...(sourceIncluded ? [db.delete(articleTags).where(eq(articleTags.articleId, articleId))] : []),
    auditEntryStatement(db, audit, changed),
  ] as const
}

/** draft or unpublished → scheduled; empty when the version or status moved on */
export function scheduleStatement(db: Db, localizationId: string, version: number, at: Date) {
  return db.update(articleLocalizations).set({ status: 'scheduled', scheduledAt: at })
    .where(and(eq(articleLocalizations.id, localizationId), eq(articleLocalizations.version, version), inArray(articleLocalizations.status, ['draft', 'unpublished'])))
    .returning({ id: articleLocalizations.id })
}

/** scheduled → draft */
export function unscheduleStatement(db: Db, localizationId: string) {
  return db.update(articleLocalizations).set({ status: 'draft', scheduledAt: null })
    .where(and(eq(articleLocalizations.id, localizationId), eq(articleLocalizations.status, 'scheduled')))
    .returning({ id: articleLocalizations.id })
}

/** Scheduled localizations whose time has come, oldest first, not deleted; `onlyArticleIds` narrows it (tests) */
export async function dueLocalizations(db: Db, now: Date, limit: number, onlyArticleIds?: readonly string[]) {
  return db.select({ id: articleLocalizations.id, articleId: articleLocalizations.articleId, locale: articleLocalizations.locale, version: articleLocalizations.version })
    .from(articleLocalizations)
    .innerJoin(articles, and(eq(articles.id, articleLocalizations.articleId), isNull(articles.deletedAt)))
    .where(and(
      eq(articleLocalizations.status, 'scheduled'),
      lte(articleLocalizations.scheduledAt, now),
      isNull(articleLocalizations.deletedAt),
      onlyArticleIds ? inArray(articleLocalizations.articleId, [...onlyArticleIds]) : undefined,
    ))
    .orderBy(asc(articleLocalizations.scheduledAt))
    .limit(limit)
}

/** The redirect that answers a public path, if any */
export async function findRedirect(db: Db, path: string): Promise<{ toPath: string, statusCode: number } | undefined> {
  const [row] = await db.select({ toPath: redirects.toPath, statusCode: redirects.statusCode }).from(redirects).where(eq(redirects.fromPath, path))
  return row
}
