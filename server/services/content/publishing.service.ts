// Publishing (data-model §8, ADR-0003 §3, F06-T4): publish, unpublish, schedule and the cron that publishes what is
// due. Publish and unpublish serve articles and projects through a PublishModel (F07-T1); scheduling is for articles
// only. Every write is one guarded D1 batch (publishing.repo.ts); the caller purges the returned tags afterwards,
// since a purge cannot join the transaction. The guards:
// - a translation publishes only `approved` (`outdated` blocks) and only once pt-BR is published;
// - informative images (cover, body, galleries) need alt text in the locale or the source (decision 3);
// - a scheduled publish runs only while the localization is still scheduled, so the cron can repeat safely
import type { SQL } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { AuditAction } from '../../../shared/audit/actions.ts'
import { articlePurgeTags } from '../../../shared/cache/purge.ts'
import type { DocumentJson } from '../../../shared/content/document-schema.ts'
import { articlePath } from '../../../shared/content/paths.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import type { Snapshot, SnapshotEntity, SnapshotInput, SluggedContentType } from '../../../shared/content/snapshot.ts'
import { toPublicImage } from '../../../shared/media/public.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, PublicationStatus } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { articleTags } from '../../db/schema/content.ts'
import { createAppError, isUniqueViolation } from '../../utils/errors.ts'
import { logger } from '../../utils/logger.ts'
import { prepareAudit, recordAudit } from '../audit/audit.service.ts'
import { findReadyMediaWithText } from '../media/media.repo.ts'
import type { ArticleDetail } from './articles.service.ts'
import { articleEntity, getArticle } from './articles.service.ts'
import type { LocalizationRow } from './localized.repo.ts'
import { articleRelations, dueLocalizations, publishStatements, scheduleStatement, unpublishStatements, unscheduleStatement } from './publishing.repo.ts'
import { prepareRevision } from './revisions.repo.ts'

/** Who acts: a signed-in user (with the request's IP for the audit) or the system (the cron) */
export interface Actor {
  userId: string | null
  ip: string | null
  ipHashSalt: string | undefined
}

export const SCHEDULE_MAX_DAYS = 366
const DUE_PER_RUN = 10

const conflict = (path: string, message: string) => createAppError('conflict', 'Cannot publish', [{ path, message }])
const staleConflict = (type: SluggedContentType) => createAppError('conflict', `The ${type} changed since it was opened`, [{ path: 'version', message: 'stale' }])

/** What a publishable item carries, whatever its type */
interface Publishable<T extends SluggedContentType> {
  id: string
  localizations: LocalizationRow<T>[]
}

/**
 * How one content type publishes (F07-T1): articles and projects share the guarded batch, and what differs between
 * them is said here
 */
export interface PublishModel<T extends SluggedContentType, D extends Publishable<T>> {
  type: T
  actions: { published: AuditAction, unpublished: AuditAction }
  /** The entity fields of the snapshot, from the working copy */
  entity: (item: D) => SnapshotEntity<T>
  /** Media ids that must have alt text when published */
  informativeImages: (item: D, body: DocumentJson) => string[]
  /** The type's own published_* columns, and their unpublished values */
  published: (snapshot: Snapshot<T>) => Record<string, unknown>
  unpublished: Record<string, null>
  /** Statements that run once the publish took effect; `isSource` for pt-BR, which owns the published relations */
  relations: (db: Db, item: D, isSource: boolean, now: Date) => (done: SQL) => BatchItem<'sqlite'>[]
  /** The published relations a pt-BR unpublish drops */
  dropRelations: (db: Db, item: D) => BatchItem<'sqlite'>[]
  path: (locale: Locale, slug: string) => string
  /** Tags to purge; `tagIds` are the taxonomy before and after the event */
  purge: (event: { id: string, locale: Locale, tagIds: readonly string[], redirect: boolean }) => string[]
  /** The taxonomy ids of a snapshot's entity (topics, technologies), for the purge */
  relationIds: (entity: SnapshotEntity<T>) => readonly string[]
  reload: (db: Db, id: string) => Promise<D>
}

/** The cover, body images without an override and the body's gallery items */
export function documentImages(coverMediaId: string | null, body: DocumentJson): Set<string> {
  const ids = new Set<string>(coverMediaId ? [coverMediaId] : [])
  for (const block of body.content) {
    if (block.type === 'image' && !block.attrs.altOverride?.trim()) {
      ids.add(block.attrs.mediaId)
    }
    else if (block.type === 'gallery') {
      block.attrs.items.forEach(id => ids.add(id))
    }
  }
  return ids
}

export const ARTICLE_PUBLISHING: PublishModel<'article', ArticleDetail> = {
  type: 'article',
  actions: { published: 'article.published', unpublished: 'article.unpublished' },
  entity: articleEntity,
  informativeImages: (article, body) => [...documentImages(article.coverMediaId, body)],
  published: snapshot => ({ publishedExcerpt: snapshot.localization.excerpt }),
  unpublished: { publishedExcerpt: null },
  relations: (db, article, isSource, now) => articleRelations(db, article.id, isSource ? article.tagIds : null, now),
  dropRelations: (db, article) => [db.delete(articleTags).where(eq(articleTags.articleId, article.id))],
  path: articlePath,
  purge: articlePurgeTags,
  relationIds: entity => entity.tagIds,
  reload: getArticle,
}

function localizationOf<T extends SluggedContentType>(item: Publishable<T>, locale: Locale): LocalizationRow<T> {
  const copy = item.localizations.find(row => row.locale === locale)
  if (!copy) {
    throw createAppError('not_found')
  }
  return copy
}

async function assertPublishable<T extends SluggedContentType, D extends Publishable<T>>(db: Db, model: PublishModel<T, D>, item: D, copy: LocalizationRow<T>): Promise<void> {
  if (copy.locale !== SOURCE_LOCALE) {
    if (copy.translationState !== 'approved') {
      throw conflict('translationState', copy.translationState)
    }
    if (!localizationOf(item, SOURCE_LOCALE).publishedRevisionId) {
      throw conflict('source', 'not_published')
    }
  }
  const ids = model.informativeImages(item, copy.body)
  if (ids.length === 0) {
    return
  }
  const found = await findReadyMediaWithText(db, ids)
  const issues = ids.flatMap((id) => {
    const row = found.rows.find(media => media.id === id)
    if (!row || row.kind !== 'image') {
      return [{ path: 'media', message: `unavailable:${id}` }]
    }
    const image = toPublicImage(row, found.localizations.filter(media => media.mediaId === id), copy.locale)
    return image.decorative || image.alt.trim() !== '' ? [] : [{ path: 'media', message: `missing_alt:${id}` }]
  })
  if (issues.length > 0) {
    throw createAppError('conflict', 'Cannot publish', issues)
  }
}

export interface PublishResult<D = ArticleDetail> {
  /** The item as it is now (an article or a project) */
  article: D
  purge: string[]
}

interface PublishOptions {
  /** The version the editor read; the cron passes the scheduled copy's */
  version: number
  from: readonly PublicationStatus[]
  action: AuditAction
  now?: Date
}

async function publish<T extends SluggedContentType, D extends Publishable<T>>(db: Db, model: PublishModel<T, D>, actor: Actor, item: D, locale: Locale, options: PublishOptions): Promise<PublishResult<D>> {
  const copy = localizationOf(item, locale)
  if (copy.version !== options.version) {
    throw staleConflict(model.type)
  }
  if (!options.from.includes(copy.status)) {
    throw conflict('status', copy.status)
  }
  await assertPublishable(db, model, item, copy)

  const now = options.now ?? new Date()
  const entity = model.entity(item)
  const snapshot = snapshotOf(model.type, entity, copy)
  const revision = await prepareRevision(model.type, { localizationId: copy.id, entityId: item.id, locale, kind: 'publish', snapshot: snapshot as SnapshotInput<T>, createdBy: actor.userId })
  const oldSlug = copy.publishedSlug
  const redirect = oldSlug && oldSlug !== copy.slug ? { from: model.path(locale, oldSlug), to: model.path(locale, copy.slug), userId: actor.userId } : null
  const isSource = locale === SOURCE_LOCALE
  const audit = await prepareAudit({ action: options.action, actorUserId: actor.userId, entityType: model.type, entityId: item.id, locale, metadata: { slug: copy.slug, redirect: redirect !== null }, ip: actor.ip }, actor.ipHashSalt)

  let updated: { id: string }[]
  try {
    [, updated] = await db.batch(publishStatements(db, model.type, {
      entityId: item.id,
      localizationId: copy.id,
      locale,
      version: options.version,
      from: options.from,
      revision,
      snapshot,
      readingTimeMin: copy.readingTimeMin,
      now,
      published: model.published(snapshot),
      redirect,
      audit,
    }, model.relations(db, item, isSource, now)))
  }
  catch (error) {
    // Another item already has this slug on the site
    if (isUniqueViolation(error)) {
      throw conflict('slug', 'published_slug_taken')
    }
    throw error
  }
  if (updated.length === 0) {
    throw staleConflict(model.type)
  }
  // Topics or technologies that the item left stop listing it too
  const previous = copy.publishedSnapshot ? model.relationIds(copy.publishedSnapshot.entity as SnapshotEntity<T>) : []
  return {
    article: await model.reload(db, item.id),
    purge: model.purge({ id: item.id, locale, tagIds: [...previous, ...(isSource ? model.relationIds(entity) : [])], redirect: redirect !== null }),
  }
}

/** Publishes now (draft, unpublished, published again, or ahead of a schedule) */
export function publishContent<T extends SluggedContentType, D extends Publishable<T>>(db: Db, model: PublishModel<T, D>, actor: Actor, item: D, locale: Locale, version: number): Promise<PublishResult<D>> {
  return publish(db, model, actor, item, locale, { version, from: ['draft', 'unpublished', 'published', 'scheduled'], action: model.actions.published })
}

/** Takes a localization off the site; for pt-BR, its published translations too (decision 4) */
export async function unpublishContent<T extends SluggedContentType, D extends Publishable<T>>(db: Db, model: PublishModel<T, D>, actor: Actor, item: D, locale: Locale): Promise<PublishResult<D>> {
  const copy = localizationOf(item, locale)
  if (!copy.publishedRevisionId) {
    throw conflict('status', copy.status)
  }
  const isSource = locale === SOURCE_LOCALE
  const targets = isSource ? item.localizations.filter(row => row.publishedRevisionId) : [copy]
  const audit = await prepareAudit({ action: model.actions.unpublished, actorUserId: actor.userId, entityType: model.type, entityId: item.id, locale, metadata: { locales: targets.map(row => row.locale).join(',') }, ip: actor.ip }, actor.ipHashSalt)
  const [unpublished] = await db.batch(unpublishStatements(db, model.type, targets.map(row => row.id), model.unpublished, isSource ? model.dropRelations(db, item) : [], audit))
  const tagIds = model.relationIds(model.entity(item))
  return {
    article: await model.reload(db, item.id),
    purge: [...new Set(unpublished.flatMap(row => model.purge({ id: item.id, locale: row.locale, tagIds, redirect: false })))],
  }
}

/** Publishes an article now (draft, unpublished, published again, or ahead of a schedule) */
export function publishArticle(db: Db, actor: Actor, article: ArticleDetail, locale: Locale, version: number): Promise<PublishResult> {
  return publishContent(db, ARTICLE_PUBLISHING, actor, article, locale, version)
}

/** Takes an article localization off the site; for pt-BR, its published translations too (decision 4) */
export function unpublishArticle(db: Db, actor: Actor, article: ArticleDetail, locale: Locale): Promise<PublishResult> {
  return unpublishContent(db, ARTICLE_PUBLISHING, actor, article, locale)
}

/** draft or unpublished → scheduled for `at` (future, at most a year ahead) */
export async function scheduleArticle(db: Db, article: ArticleDetail, locale: Locale, version: number, at: Date, now = new Date()): Promise<ArticleDetail> {
  const copy = localizationOf<'article'>(article, locale)
  if (at.getTime() <= now.getTime() || at.getTime() > now.getTime() + SCHEDULE_MAX_DAYS * 24 * 3600 * 1000) {
    throw createAppError('bad_request', 'Invalid input', [{ path: 'at', message: 'must be in the future, within a year' }])
  }
  if (copy.status !== 'draft' && copy.status !== 'unpublished') {
    throw conflict('status', copy.status)
  }
  await assertPublishable(db, ARTICLE_PUBLISHING, article, copy)
  const [updated] = await scheduleStatement(db, copy.id, version, at)
  if (!updated) {
    throw createAppError('conflict', 'The article changed since it was opened', [{ path: 'version', message: 'stale' }])
  }
  return getArticle(db, article.id)
}

export async function unscheduleArticle(db: Db, article: ArticleDetail, locale: Locale): Promise<ArticleDetail> {
  const copy = localizationOf<'article'>(article, locale)
  const [updated] = await unscheduleStatement(db, copy.id)
  if (!updated) {
    throw conflict('status', copy.status)
  }
  return getArticle(db, article.id)
}

/**
 * The cron (decision 2: what is published is the working copy at that moment). Each due localization publishes only
 * while still scheduled, so a second run, or two overlapping runs, publish nothing twice. One that fails its guards
 * goes back to draft, audited, instead of being retried every 5 minutes
 */
export async function publishDue(db: Db, now: Date, limit = DUE_PER_RUN, onlyArticleIds?: readonly string[]): Promise<{ published: number, failed: number, purge: string[] }> {
  const system: Actor = { userId: null, ip: null, ipHashSalt: undefined }
  const purge = new Set<string>()
  let published = 0
  let failed = 0
  for (const due of await dueLocalizations(db, now, limit, onlyArticleIds)) {
    try {
      const article = await getArticle(db, due.articleId)
      const result = await publish(db, ARTICLE_PUBLISHING, system, article, due.locale, { version: due.version, from: ['scheduled'], action: 'article.published_on_schedule', now })
      result.purge.forEach(tag => purge.add(tag))
      published++
    }
    catch (error) {
      failed++
      const reason = (error as { data?: { issues?: { path: string, message: string }[] } }).data?.issues?.map(issue => `${issue.path}:${issue.message}`).join(';') ?? (error instanceof Error ? error.message.slice(0, 200) : 'unknown')
      logger.error('content.publish_due.failed', { articleId: due.articleId, locale: due.locale, reason })
      // Only stale data is worth retrying (the copy was saved meanwhile); anything else would fail every run
      if (!reason.startsWith('version:')) {
        await unscheduleStatement(db, due.id)
        await recordAudit(db, { action: 'article.schedule_failed', actorUserId: null, entityType: 'article', entityId: due.articleId, metadata: { locale: due.locale, reason: reason.slice(0, 200) } }, undefined)
      }
    }
  }
  return { published, failed, purge: [...purge] }
}
