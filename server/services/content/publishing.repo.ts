// Publication writes (data-model §8–§9, F06-T4; projects since F07-T1) as statements for one D1 batch each. A
// publish inserts the `publish` revision first (the localization's pointer has a foreign key to it), then moves the
// localization only while it still has the version and status read; every later statement runs only if the
// localization now points at this revision, so a stale or repeated publish changes nothing, and any failure rolls
// the whole batch back
import { and, asc, eq, exists, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Snapshot, SluggedContentType } from '../../../shared/content/snapshot.ts'
import type { Locale, PublicationStatus } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { articleLocalizations, articles, articleTags, projectTechnologies } from '../../db/schema/content.ts'
import { redirects } from '../../db/schema/system.ts'
import type { AuditRow } from '../audit/audit.repo.ts'
import { auditEntryStatement } from '../audit/audit.repo.ts'
import { contentTables } from './content-tables.ts'
import type { ContentTables } from './content-tables.ts'
import type { PreparedRevision } from './revisions.repo.ts'
import { insertRevisionStatement } from './revisions.repo.ts'

// The two tables differ only in their entity key (localizationEntityId); the casts stay here
const tablesOf = (type: SluggedContentType) => contentTables[type] as unknown as ContentTables['article']

/** SQL true while the localization has this version and one of these statuses */
function copyIs(db: Db, type: SluggedContentType, localizationId: string, version: number, statuses: readonly PublicationStatus[]): SQL {
  const { localizations } = tablesOf(type)
  return exists(db.select({ one: sql`1` }).from(localizations).where(and(
    eq(localizations.id, localizationId),
    eq(localizations.version, version),
    inArray(localizations.status, [...statuses]),
    isNull(localizations.deletedAt),
  )))
}

/** SQL true once the localization points at this revision: the publish took effect */
export function pointsAt(db: Db, type: SluggedContentType, localizationId: string, revisionId: string): SQL {
  const { localizations } = tablesOf(type)
  return exists(db.select({ one: sql`1` }).from(localizations)
    .where(and(eq(localizations.id, localizationId), eq(localizations.publishedRevisionId, revisionId))))
}

export interface PublishWrite<T extends SluggedContentType> {
  entityId: string
  localizationId: string
  locale: Locale
  version: number
  /** The statuses the localization may be in for this publish (the cron: scheduled only) */
  from: readonly PublicationStatus[]
  revision: PreparedRevision
  snapshot: Snapshot<T>
  readingTimeMin: number
  now: Date
  /** The type's own published_* columns (an article's excerpt, a project's summary) */
  published: Record<string, unknown>
  /** The old and new public paths when the published slug changes */
  redirect: { from: string, to: string, userId: string | null } | null
  audit: AuditRow
}

/** pt-BR publish of an article: article_tags rebuilt from the draft topics, and the first publication date */
export function articleRelations(db: Db, articleId: string, tagIds: string[] | null, now: Date) {
  return (done: SQL) => [
    db.update(articles).set({ firstPublishedAt: sql`coalesce(${articles.firstPublishedAt}, ${now.getTime()})` })
      .where(and(eq(articles.id, articleId), done)),
    ...(tagIds === null
      ? []
      : [
          db.delete(articleTags).where(and(eq(articleTags.articleId, articleId), done)),
          db.insert(articleTags).select(db.select({
            articleId: sql<string>`${articleId}`.as('article_id'),
            tagId: sql<string>`value`.as('tag_id'),
          }).from(sql`json_each(${JSON.stringify(tagIds)})`).where(and(done, sql`value IN (SELECT id FROM tags)`))),
        ]),
  ]
}

/** pt-BR publish of a project: project_technologies rebuilt from the draft, in the draft's order */
export function projectRelations(db: Db, projectId: string, technologyIds: string[] | null) {
  return (done: SQL) => technologyIds === null
    ? []
    : [
        db.delete(projectTechnologies).where(and(eq(projectTechnologies.projectId, projectId), done)),
        db.insert(projectTechnologies).select(db.select({
          projectId: sql<string>`${projectId}`.as('project_id'),
          tagId: sql<string>`value`.as('tag_id'),
          position: sql<number>`CAST(key AS INTEGER)`.as('position'),
        }).from(sql`json_each(${JSON.stringify(technologyIds)})`).where(and(done, sql`value IN (SELECT id FROM tags)`))),
      ]
}

export function publishStatements<T extends SluggedContentType, R extends readonly unknown[]>(db: Db, type: T, write: PublishWrite<T>, relations: (done: SQL) => R) {
  const { localizations } = tablesOf(type)
  const before = copyIs(db, type, write.localizationId, write.version, write.from)
  const done = pointsAt(db, type, write.localizationId, write.revision.id)
  const { localization, entity } = write.snapshot
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
          entityType: sql<string>`${type}`.as('entity_type'),
          entityId: sql<string>`${write.entityId}`.as('entity_id'),
          createdBy: sql<string | null>`${write.redirect.userId}`.as('created_by'),
          createdAt: sql<number>`${write.now.getTime()}`.as('created_at'),
        } as never).from(sql`(SELECT 1)`).where(done)).onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: write.redirect.to } }),
      ]
  return [
    insertRevisionStatement(db, type, write.revision, before),
    db.update(localizations).set({
      status: 'published',
      scheduledAt: null,
      publishedRevisionId: write.revision.id,
      publishedSnapshot: write.snapshot as never,
      publishedSlug: localization.slug,
      publishedTitle: localization.title,
      publishedCoverMediaId: entity.coverMediaId,
      publishedReadingTimeMin: write.readingTimeMin,
      publishedAt: write.now,
      ...write.published,
    }).where(and(eq(localizations.id, write.localizationId), before)).returning({ id: localizations.id }),
    ...relations(done),
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
  publishedCoverMediaId: null,
  publishedReadingTimeMin: null,
  publishedAt: null,
}

/**
 * Takes localizations off the site (revisions stay). `localizationIds` are the localization and, for pt-BR, every
 * published translation (decision 4); `published` nulls the type's own published_* columns, and `relations` are the
 * published relations to drop when pt-BR goes. The first result lists what was unpublished
 */
export function unpublishStatements<R extends readonly unknown[]>(db: Db, type: SluggedContentType, localizationIds: string[], published: Record<string, null>, relations: R, audit: AuditRow) {
  const { localizations } = tablesOf(type)
  const target = and(inArray(localizations.id, localizationIds), isNotNull(localizations.publishedRevisionId))
  const changed = exists(db.select({ one: sql`1` }).from(localizations)
    .where(and(inArray(localizations.id, localizationIds), eq(localizations.status, 'unpublished'), isNull(localizations.publishedRevisionId))))
  return [
    db.update(localizations).set({ ...UNPUBLISHED, ...published }).where(target).returning({ id: localizations.id, locale: localizations.locale }),
    ...relations,
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
