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
import type { Locale, MediaUsageContext } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { MAX_SLUG_LENGTH, slugify } from '../../../shared/utils/slugify.ts'
import type { Db } from '../../db/client.ts'
import { createAppError, isUniqueViolation } from '../../utils/errors.ts'
import { findMediaStates } from '../media/media.repo.ts'
import type { ArticleFilters, ArticleListCursor, ArticleLocalizationRow, ArticleRow } from './articles.repo.ts'
import {
  findArticle,
  findArticleLocalizations,
  insertArticleStatements,
  isSlugTaken,
  listArticles as listArticleRows,
  saveArticleStatements,
  softDeleteStatements,
  takenSlugs,
} from './articles.repo.ts'
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

/** The fields an input changes, by name; the audit lists them */
export function changedFields(input: ArticleUpdate): string[] {
  return Object.keys(input).filter(key => key !== 'version')
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
  const next = { ...current, ...fields }
  const entity = { coverMediaId: coverMediaId === undefined ? article.coverMediaId : coverMediaId, tagIds: tagIds ?? article.tagIds }
  await assertMedia(db, input, next.body)

  const derived = deriveDocument(next.body, SOURCE_LOCALE)
  const workingHash = await contentHash(snapshotOf('article', entity, next))
  const uses: { mediaId: string, locale: Locale | null, context: MediaUsageContext }[] = [
    ...derived.mediaUsages.map(use => ({ mediaId: use.mediaId, locale: SOURCE_LOCALE, context: use.context })),
    ...(entity.coverMediaId ? [{ mediaId: entity.coverMediaId, locale: null, context: 'cover' as const }] : []),
    ...(next.ogImageMediaId ? [{ mediaId: next.ogImageMediaId, locale: SOURCE_LOCALE, context: 'og' as const }] : []),
  ]

  let updated: { id: string }[]
  try {
    [updated] = await db.batch(saveArticleStatements(db, {
      articleId: article.id,
      localizationId: current.id,
      version,
      workingHash,
      localization: { ...fields, wordCount: derived.wordCount, readingTimeMin: derived.readingTimeMin, toc: derived.toc, updatedBy: userId },
      entity: { coverMediaId: entity.coverMediaId, draftTagIds: entity.tagIds, ...(featured === undefined ? {} : { featured }), updatedBy: userId },
      uses,
    }))
  }
  catch (error) {
    throw isUniqueViolation(error) ? slugConflict() : error
  }
  if (updated.length === 0) {
    throw versionConflict()
  }
  return getArticle(db, article.id)
}

/** Soft delete; the slug is free again. A published article is unpublished first (F06-T4) */
export async function deleteArticle(db: Db, userId: string, article: ArticleDetail): Promise<void> {
  if (article.localizations.some(item => item.publishedRevisionId !== null)) {
    throw createAppError('conflict', 'Unpublish the article first', [{ path: 'status', message: 'published' }])
  }
  await db.batch(softDeleteStatements(db, article.id, userId))
}
