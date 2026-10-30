// Publishing (data-model §8, ADR-0003 §3, F06-T4): publish, unpublish, schedule and the cron that publishes what is
// due. Every write is one guarded D1 batch (publishing.repo.ts); the caller purges the returned tags afterwards,
// since a purge cannot join the transaction. The guards:
// - a translation publishes only `approved` (`outdated` blocks) and only once pt-BR is published;
// - informative images (cover, body, galleries) need alt text in the locale or the source (decision 3);
// - a scheduled publish runs only while the localization is still scheduled, so the cron can repeat safely
import { articlePurgeTags } from '../../../shared/cache/purge.ts'
import type { AuditAction } from '../../../shared/audit/actions.ts'
import type { DocumentJson } from '../../../shared/content/document-schema.ts'
import { articlePath } from '../../../shared/content/paths.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import { toPublicImage } from '../../../shared/media/public.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, PublicationStatus } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { createAppError, isUniqueViolation } from '../../utils/errors.ts'
import { logger } from '../../utils/logger.ts'
import { prepareAudit, recordAudit } from '../audit/audit.service.ts'
import { findReadyMediaWithText } from '../media/media.repo.ts'
import type { ArticleLocalizationRow } from './articles.repo.ts'
import type { ArticleDetail } from './articles.service.ts'
import { getArticle } from './articles.service.ts'
import { dueLocalizations, publishStatements, scheduleStatement, unpublishStatements, unscheduleStatement } from './publishing.repo.ts'
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

function localizationOf(article: ArticleDetail, locale: Locale): ArticleLocalizationRow {
  const copy = article.localizations.find(item => item.locale === locale)
  if (!copy) {
    throw createAppError('not_found')
  }
  return copy
}

/** Media ids that must have alt text when published: the cover, body images without an override, gallery items */
function informativeImages(article: ArticleDetail, body: DocumentJson): string[] {
  const ids = new Set<string>(article.coverMediaId ? [article.coverMediaId] : [])
  for (const block of body.content) {
    if (block.type === 'image' && !block.attrs.altOverride?.trim()) {
      ids.add(block.attrs.mediaId)
    }
    else if (block.type === 'gallery') {
      block.attrs.items.forEach(id => ids.add(id))
    }
  }
  return [...ids]
}

async function assertPublishable(db: Db, article: ArticleDetail, copy: ArticleLocalizationRow): Promise<void> {
  if (copy.locale !== SOURCE_LOCALE) {
    if (copy.translationState !== 'approved') {
      throw conflict('translationState', copy.translationState)
    }
    if (!localizationOf(article, SOURCE_LOCALE).publishedRevisionId) {
      throw conflict('source', 'not_published')
    }
  }
  const ids = informativeImages(article, copy.body)
  if (ids.length === 0) {
    return
  }
  const found = await findReadyMediaWithText(db, ids)
  const issues = ids.flatMap((id) => {
    const row = found.rows.find(item => item.id === id)
    if (!row || row.kind !== 'image') {
      return [{ path: 'media', message: `unavailable:${id}` }]
    }
    const image = toPublicImage(row, found.localizations.filter(item => item.mediaId === id), copy.locale)
    return image.decorative || image.alt.trim() !== '' ? [] : [{ path: 'media', message: `missing_alt:${id}` }]
  })
  if (issues.length > 0) {
    throw createAppError('conflict', 'Cannot publish', issues)
  }
}

export interface PublishResult {
  article: ArticleDetail
  purge: string[]
}

interface PublishOptions {
  /** The version the editor read; the cron passes the scheduled copy's */
  version: number
  from: readonly PublicationStatus[]
  action: AuditAction
  now?: Date
}

async function publish(db: Db, actor: Actor, article: ArticleDetail, locale: Locale, options: PublishOptions): Promise<PublishResult> {
  const copy = localizationOf(article, locale)
  if (copy.version !== options.version) {
    throw createAppError('conflict', 'The article changed since it was opened', [{ path: 'version', message: 'stale' }])
  }
  if (!options.from.includes(copy.status)) {
    throw conflict('status', copy.status)
  }
  await assertPublishable(db, article, copy)

  const now = options.now ?? new Date()
  const snapshot = snapshotOf('article', { coverMediaId: article.coverMediaId, tagIds: article.tagIds }, copy)
  const revision = await prepareRevision('article', { localizationId: copy.id, entityId: article.id, locale, kind: 'publish', snapshot, createdBy: actor.userId })
  const oldSlug = copy.publishedSlug
  const redirect = oldSlug && oldSlug !== copy.slug ? { from: articlePath(locale, oldSlug), to: articlePath(locale, copy.slug), userId: actor.userId } : null
  const isSource = locale === SOURCE_LOCALE
  const audit = await prepareAudit({ action: options.action, actorUserId: actor.userId, entityType: 'article', entityId: article.id, locale, metadata: { slug: copy.slug, redirect: redirect !== null }, ip: actor.ip }, actor.ipHashSalt)

  let updated: { id: string }[]
  try {
    [, updated] = await db.batch(publishStatements(db, {
      articleId: article.id,
      localizationId: copy.id,
      locale,
      version: options.version,
      from: options.from,
      revision,
      snapshot,
      readingTimeMin: copy.readingTimeMin,
      now,
      tagIds: isSource ? article.tagIds : null,
      redirect,
      audit,
    }))
  }
  catch (error) {
    // Another article already has this slug on the site
    if (isUniqueViolation(error)) {
      throw conflict('slug', 'published_slug_taken')
    }
    throw error
  }
  if (updated.length === 0) {
    throw createAppError('conflict', 'The article changed since it was opened', [{ path: 'version', message: 'stale' }])
  }
  // Topics that the article left stop listing it too
  const previousTags = copy.publishedSnapshot?.entity.tagIds ?? []
  return {
    article: await getArticle(db, article.id),
    purge: articlePurgeTags({ id: article.id, locale, tagIds: [...previousTags, ...(isSource ? article.tagIds : [])], redirect: redirect !== null }),
  }
}

/** Publishes now (draft, unpublished, published again, or ahead of a schedule) */
export function publishArticle(db: Db, actor: Actor, article: ArticleDetail, locale: Locale, version: number): Promise<PublishResult> {
  return publish(db, actor, article, locale, { version, from: ['draft', 'unpublished', 'published', 'scheduled'], action: 'article.published' })
}

/** Takes a localization off the site; for pt-BR, its published translations too (decision 4) */
export async function unpublishArticle(db: Db, actor: Actor, article: ArticleDetail, locale: Locale): Promise<PublishResult> {
  const copy = localizationOf(article, locale)
  if (!copy.publishedRevisionId) {
    throw conflict('status', copy.status)
  }
  const isSource = locale === SOURCE_LOCALE
  const targets = isSource ? article.localizations.filter(item => item.publishedRevisionId) : [copy]
  const audit = await prepareAudit({ action: 'article.unpublished', actorUserId: actor.userId, entityType: 'article', entityId: article.id, locale, metadata: { locales: targets.map(item => item.locale).join(',') }, ip: actor.ip }, actor.ipHashSalt)
  const [unpublished] = await db.batch(unpublishStatements(db, article.id, targets.map(item => item.id), isSource, audit))
  return {
    article: await getArticle(db, article.id),
    purge: [...new Set(unpublished.flatMap(item => articlePurgeTags({ id: article.id, locale: item.locale, tagIds: article.tagIds })))],
  }
}

/** draft or unpublished → scheduled for `at` (future, at most a year ahead) */
export async function scheduleArticle(db: Db, article: ArticleDetail, locale: Locale, version: number, at: Date, now = new Date()): Promise<ArticleDetail> {
  const copy = localizationOf(article, locale)
  if (at.getTime() <= now.getTime() || at.getTime() > now.getTime() + SCHEDULE_MAX_DAYS * 24 * 3600 * 1000) {
    throw createAppError('bad_request', 'Invalid input', [{ path: 'at', message: 'must be in the future, within a year' }])
  }
  if (copy.status !== 'draft' && copy.status !== 'unpublished') {
    throw conflict('status', copy.status)
  }
  await assertPublishable(db, article, copy)
  const [updated] = await scheduleStatement(db, copy.id, version, at)
  if (!updated) {
    throw createAppError('conflict', 'The article changed since it was opened', [{ path: 'version', message: 'stale' }])
  }
  return getArticle(db, article.id)
}

export async function unscheduleArticle(db: Db, article: ArticleDetail, locale: Locale): Promise<ArticleDetail> {
  const copy = localizationOf(article, locale)
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
      const result = await publish(db, system, article, due.locale, { version: due.version, from: ['scheduled'], action: 'article.published_on_schedule', now })
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
