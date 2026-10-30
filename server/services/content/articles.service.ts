// Articles in the admin (F06-T1, data-model §4.1–4.2): create, read, save the pt-BR working copy and soft delete.
// A save is one D1 batch (articles.repo.ts, saveArticleStatements): the working copy guarded by the version the
// editor read, the entity fields (cover, topics, featured) and the article's media uses; a stale save changes
// nothing and answers 409. Revisions and autosave are F06-T2, publishing is F06-T4
import type { ArticleUpdate } from '../../../shared/content/article-input.ts'
import { contentHash } from '../../../shared/content/canonical-json.ts'
import { CURRENT_SCHEMA_VERSION } from '../../../shared/content/document-schema.ts'
import type { DocumentJson } from '../../../shared/content/document-schema.ts'
import { deriveDocument } from '../../../shared/content/derive.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, MediaUsageContext, RevisionKind } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { MAX_SLUG_LENGTH, slugify } from '../../../shared/utils/slugify.ts'
import type { Db } from '../../db/client.ts'
import { createAppError, isUniqueViolation } from '../../utils/errors.ts'
import { findMediaStates } from '../media/media.repo.ts'
import type { ArticleFilters, ArticleListCursor, ArticleLocalizationRow, ArticleRow } from './articles.repo.ts'
import {
  copyAtVersion,
  findArticle,
  findArticleLocalizations,
  insertArticleStatements,
  isSlugTaken,
  listArticles as listArticleRows,
  saveArticleStatements,
  softDeleteStatements,
  takenSlugs,
} from './articles.repo.ts'
import type { RevisionMeta } from './revisions.repo.ts'
import { getRevision, insertRevisionStatement, listRevisions, prepareRevision, userNames } from './revisions.repo.ts'
import { existingTagIds } from './tags.repo.ts'

export const EMPTY_DOCUMENT: DocumentJson = { type: 'doc', attrs: { schemaVersion: CURRENT_SCHEMA_VERSION }, content: [] }
/** When a title has no letter or digit left for a slug */
const FALLBACK_SLUG = 'artigo'

export interface ArticleDetail {
  id: string
  authorId: string
  authorName: string | null
  featured: boolean
  coverMediaId: string | null
  tagIds: string[]
  createdAt: Date
  updatedAt: Date
  localizations: ArticleLocalizationRow[]
}

const detailOf = (article: ArticleRow & { authorName: string | null }, localizations: ArticleLocalizationRow[]): ArticleDetail => ({
  id: article.id,
  authorId: article.authorId,
  authorName: article.authorName,
  featured: article.featured,
  coverMediaId: article.coverMediaId,
  tagIds: article.draftTagIds,
  createdAt: article.createdAt,
  updatedAt: article.updatedAt,
  localizations,
})

const slugConflict = () => createAppError('conflict', 'Slug already used', [{ path: 'slug', message: 'slug_taken' }])
const versionConflict = () => createAppError('conflict', 'The article changed since it was opened', [{ path: 'version', message: 'stale' }])

/** The article and its working copies; 404 for a missing or deleted one */
export async function getArticle(db: Db, id: string): Promise<ArticleDetail> {
  const article = await findArticle(db, id)
  if (!article) {
    throw createAppError('not_found')
  }
  return detailOf(article, await findArticleLocalizations(db, [id]))
}

export async function listArticles(db: Db, filters: ArticleFilters, cursor: string | undefined, limit: number) {
  const rows = await listArticleRows(db, filters, cursor === undefined ? undefined : decodeListCursor(cursor), limit)
  const page = rows.slice(0, limit)
  const localizations = await findArticleLocalizations(db, page.map(row => row.article.id))
  const last = page.at(-1)
  return {
    items: page.map(({ article, authorName }) => ({
      id: article.id,
      authorId: article.authorId,
      authorName,
      featured: article.featured,
      updatedAt: article.updatedAt,
      localizations: localizations.filter(item => item.articleId === article.id).map(item => ({
        locale: item.locale,
        title: item.title,
        slug: item.slug,
        status: item.status,
        translationState: item.translationState,
        updatedAt: item.updatedAt,
      })),
    })),
    nextCursor: rows.length > limit && last ? encodeListCursor({ updatedAt: last.article.updatedAt.getTime(), id: last.article.id }) : null,
  }
}

export function encodeListCursor({ updatedAt, id }: ArticleListCursor): string {
  return btoa(`${updatedAt}:${id}`).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decodeListCursor(cursor: string): ArticleListCursor {
  try {
    const match = /^(\d{1,15}):([\w-]{1,64})$/.exec(atob(cursor.replaceAll('-', '+').replaceAll('_', '/')))
    if (match) {
      return { updatedAt: Number(match[1]), id: match[2]! }
    }
  }
  catch {
    // Not base64: the same answer as any other bad cursor
  }
  throw createAppError('bad_request', 'Invalid cursor', [{ path: 'cursor', message: 'invalid' }])
}

/** A new draft with its pt-BR working copy; the slug comes from the title, with -2, -3… when it is taken */
export async function createArticle(db: Db, userId: string, title: string): Promise<ArticleDetail> {
  const base = slugify(title, MAX_SLUG_LENGTH - 4) || FALLBACK_SLUG
  const taken = await takenSlugs(db, SOURCE_LOCALE, base)
  let slug = base
  for (let n = 2; taken.has(slug); n++) {
    slug = `${base}-${n}`
  }
  const id = uuidv7()
  const localization = {
    id: uuidv7(),
    articleId: id,
    locale: SOURCE_LOCALE,
    title,
    slug,
    excerpt: '',
    body: EMPTY_DOCUMENT,
    translationState: 'source' as const,
    updatedBy: userId,
  }
  const workingHash = await contentHash(snapshotOf('article', { coverMediaId: null, tagIds: [] }, localization))
  try {
    await db.batch(insertArticleStatements(db, { id, authorId: userId, createdBy: userId, updatedBy: userId }, { ...localization, workingHash }))
  }
  catch (error) {
    // Someone took the slug between the check and the insert
    throw isUniqueViolation(error) ? slugConflict() : error
  }
  return getArticle(db, id)
}

async function assertMedia(db: Db, input: ArticleUpdate, body: DocumentJson): Promise<void> {
  const images = { coverMediaId: input.coverMediaId, ogImageMediaId: input.ogImageMediaId }
  const bodyIds = input.body ? deriveDocument(body, SOURCE_LOCALE).mediaUsages.map(use => use.mediaId) : []
  const ids = [...Object.values(images).filter((value): value is string => typeof value === 'string'), ...bodyIds]
  if (ids.length === 0) {
    return
  }
  const states = await findMediaStates(db, ids)
  const issues: { path: string, message: string }[] = []
  for (const [field, mediaId] of Object.entries(images)) {
    const state = typeof mediaId === 'string' ? states.get(mediaId) : undefined
    if (typeof mediaId === 'string' && (state?.kind !== 'image' || state.status !== 'ready')) {
      issues.push({ path: field, message: 'must be a ready image' })
    }
  }
  for (const mediaId of new Set(bodyIds)) {
    if (!states.has(mediaId)) {
      issues.push({ path: 'body', message: `media ${mediaId} does not exist` })
    }
  }
  if (issues.length > 0) {
    throw createAppError('bad_request', 'Invalid input', issues)
  }
}

/**
 * Saves the pt-BR working copy and the entity fields. 409 with path "version" when the copy changed since the
 * editor read it, and with path "slug" when another article of the locale has the slug
 */
export async function updateArticle(db: Db, userId: string, article: ArticleDetail, input: ArticleUpdate): Promise<ArticleDetail> {
  const current = article.localizations.find(item => item.locale === SOURCE_LOCALE)
  if (!current) {
    throw createAppError('not_found')
  }
  if (current.version !== input.version) {
    throw versionConflict()
  }
  if (input.slug !== undefined && input.slug !== current.slug && await isSlugTaken(db, SOURCE_LOCALE, input.slug, current.id)) {
    throw slugConflict()
  }
  if (input.tagIds && input.tagIds.length > 0) {
    const found = await existingTagIds(db, input.tagIds, 'topic')
    const missing = input.tagIds.filter(id => !found.has(id))
    if (missing.length > 0) {
      throw createAppError('bad_request', 'Invalid input', missing.map(id => ({ path: 'tagIds', message: `topic ${id} does not exist` })))
    }
  }

  const { version, featured, coverMediaId, tagIds, ...localized } = input
  const fields = Object.fromEntries(Object.entries(localized).filter(([, value]) => value !== undefined)) as Partial<ArticleLocalizationRow>
  const entity = { coverMediaId: coverMediaId === undefined ? article.coverMediaId : coverMediaId, tagIds: tagIds ?? article.tagIds }
  await assertMedia(db, input, { ...current, ...fields }.body)
  await writeWorkingCopy(db, userId, article, current, { version, fields, entity, featured, kind: 'autosave' })
  return getArticle(db, article.id)
}

interface CopyWrite {
  version: number
  fields: Partial<ArticleLocalizationRow>
  entity: { coverMediaId: string | null, tagIds: string[] }
  featured?: boolean | undefined
  /** The revision the write records: every save is an autosave (deduplicated), a restore always records */
  kind: 'autosave' | 'restore'
}

/**
 * Writes the working copy, derived data, entity fields, media uses and the write's revision in one batch guarded by
 * the version (articles.repo.ts, saveArticleStatements). 409 on "version" when it changed, on "slug" when taken
 */
async function writeWorkingCopy(db: Db, userId: string, article: ArticleDetail, current: ArticleLocalizationRow, write: CopyWrite): Promise<void> {
  const next = { ...current, ...write.fields }
  const derived = deriveDocument(next.body, SOURCE_LOCALE)
  const snapshot = snapshotOf('article', write.entity, next)
  const workingHash = await contentHash(snapshot)
  const uses: { mediaId: string, locale: Locale | null, context: MediaUsageContext }[] = [
    ...derived.mediaUsages.map(use => ({ mediaId: use.mediaId, locale: SOURCE_LOCALE, context: use.context })),
    ...(write.entity.coverMediaId ? [{ mediaId: write.entity.coverMediaId, locale: null, context: 'cover' as const }] : []),
    ...(next.ogImageMediaId ? [{ mediaId: next.ogImageMediaId, locale: SOURCE_LOCALE, context: 'og' as const }] : []),
  ]
  const revision = await prepareRevision('article', { localizationId: current.id, entityId: article.id, locale: SOURCE_LOCALE, kind: write.kind, snapshot, createdBy: userId })

  let updated: { id: string }[]
  try {
    [updated] = await db.batch(saveArticleStatements(db, {
      articleId: article.id,
      localizationId: current.id,
      version: write.version,
      workingHash,
      localization: { ...write.fields, wordCount: derived.wordCount, readingTimeMin: derived.readingTimeMin, toc: derived.toc, updatedBy: userId },
      entity: { coverMediaId: write.entity.coverMediaId, draftTagIds: write.entity.tagIds, ...(write.featured === undefined ? {} : { featured: write.featured }), updatedBy: userId },
      uses,
      revision,
    }))
  }
  catch (error) {
    throw isUniqueViolation(error) ? slugConflict() : error
  }
  if (updated.length === 0) {
    throw versionConflict()
  }
}

const sourceCopy = (article: ArticleDetail): ArticleLocalizationRow => {
  const current = article.localizations.find(item => item.locale === SOURCE_LOCALE)
  if (!current) {
    throw createAppError('not_found')
  }
  return current
}

export interface RevisionListItem {
  id: string
  number: number
  kind: RevisionKind
  note: string | null
  authorName: string | null
  createdAt: Date
}

/** The pt-BR history, newest first, without snapshots */
export async function listArticleRevisions(db: Db, article: ArticleDetail): Promise<RevisionListItem[]> {
  const revisions = await listRevisions(db, 'article', sourceCopy(article).id)
  const names = await userNames(db, revisions.flatMap(revision => (revision.createdBy ? [revision.createdBy] : [])))
  return revisions.map(({ id, number, kind, note, createdBy, createdAt }) => ({ id, number, kind, note, authorName: createdBy ? names.get(createdBy) ?? null : null, createdAt }))
}

/** One pt-BR revision with its snapshot; 404 for a revision of another article or locale */
export async function getArticleRevision(db: Db, article: ArticleDetail, revisionId: string) {
  const revision = await getRevision(db, 'article', sourceCopy(article).id, revisionId)
  if (!revision) {
    throw createAppError('not_found')
  }
  const { contentHash: _hash, createdBy, ...rest } = revision
  const names = await userNames(db, createdBy ? [createdBy] : [])
  return { ...rest, authorName: createdBy ? names.get(createdBy) ?? null : null }
}

/**
 * A named version of the working copy as the editor last saved it (decision 3: a repeat of the latest manual version
 * with the same note is dropped). 409 on "version" when the copy changed since
 */
export async function saveArticleVersion(db: Db, userId: string, article: ArticleDetail, input: { version: number, note: string | null }): Promise<{ revision: RevisionListItem, created: boolean }> {
  const current = sourceCopy(article)
  if (current.version !== input.version) {
    throw versionConflict()
  }
  const snapshot = snapshotOf('article', { coverMediaId: article.coverMediaId, tagIds: article.tagIds }, current)
  const prepared = await prepareRevision('article', { localizationId: current.id, entityId: article.id, locale: SOURCE_LOCALE, kind: 'manual', snapshot, note: input.note, createdBy: userId })
  const [inserted] = await insertRevisionStatement(db, 'article', prepared, copyAtVersion(db, current.id, input.version))
  if (inserted) {
    const names = await userNames(db, [userId])
    return { revision: { ...listItemOf(inserted), authorName: names.get(userId) ?? null }, created: true }
  }
  // Not written: either the copy moved on, or this repeats the latest manual version
  const now = sourceCopy(await getArticle(db, article.id))
  if (now.version !== input.version) {
    throw versionConflict()
  }
  const [latest] = (await listArticleRevisions(db, article)).filter(revision => revision.kind === 'manual')
  return { revision: latest!, created: false }
}

const listItemOf = ({ id, number, kind, note, createdAt }: RevisionMeta) => ({ id, number, kind, note, createdAt })

/**
 * Copies a pt-BR revision back into the working copy (title, slug, excerpt, body, SEO, cover and topics) and records
 * a `restore` revision; nothing is deleted. Topics deleted since are left out. 409 on "version" when the copy
 * changed since the editor read it, on "slug" when another article took the slug meanwhile
 */
export async function restoreArticleRevision(db: Db, userId: string, article: ArticleDetail, input: { version: number, revisionId: string }): Promise<{ article: ArticleDetail, restored: number }> {
  const current = sourceCopy(article)
  if (current.version !== input.version) {
    throw versionConflict()
  }
  const revision = await getRevision(db, 'article', current.id, input.revisionId)
  if (!revision) {
    throw createAppError('not_found')
  }
  const { localization, entity } = revision.snapshot
  if (localization.slug !== current.slug && await isSlugTaken(db, SOURCE_LOCALE, localization.slug, current.id)) {
    throw slugConflict()
  }
  const topics = await existingTagIds(db, entity.tagIds, 'topic')
  await writeWorkingCopy(db, userId, article, current, {
    version: input.version,
    fields: localization,
    entity: { coverMediaId: entity.coverMediaId, tagIds: entity.tagIds.filter(id => topics.has(id)) },
    kind: 'restore',
  })
  return { article: await getArticle(db, article.id), restored: revision.number }
}

/** Soft delete; the slug is free again. A published article is unpublished first (F06-T4) */
export async function deleteArticle(db: Db, userId: string, article: ArticleDetail): Promise<void> {
  if (article.localizations.some(item => item.publishedRevisionId !== null)) {
    throw createAppError('conflict', 'Unpublish the article first', [{ path: 'status', message: 'published' }])
  }
  await db.batch(softDeleteStatements(db, article.id, userId))
}
