// Articles in the admin (F06-T1, data-model §4.1–4.2): create, read, save the pt-BR working copy and soft delete.
// A save is one D1 batch (working-copy.ts, shared with projects): the working copy guarded by the version the
// editor read, the entity fields (cover, topics, featured) and the article's media uses; a stale save changes
// nothing and answers 409. Revisions and autosave are F06-T2, publishing is F06-T4
import type { ArticleUpdate } from '../../../shared/content/article-input.ts'
import { contentHash } from '../../../shared/content/canonical-json.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import type { SnapshotEntity } from '../../../shared/content/snapshot.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { createAppError, isUniqueViolation } from '../../utils/errors.ts'
import type { ArticleFilters, ArticleLocalizationRow, ArticleRow } from './articles.repo.ts'
import { findArticle, insertArticleStatements, listArticles as listArticleRows } from './articles.repo.ts'
import { existingTagIds } from './tags.repo.ts'
import type { RevisionListItem } from './working-copy.ts'
import {
  assertMedia,
  assertSavable,
  decodeListCursor,
  EMPTY_DOCUMENT,
  encodeListCursor,
  freeSlug,
  getSourceRevision,
  listSourceRevisions,
  restorableRevision,
  saveSourceVersion,
  slugConflict,
  sourceCopyOf,
  writeWorkingCopy,
} from './working-copy.ts'
import { findLocalizations, softDeleteStatements } from './working-copy.repo.ts'

export { EMPTY_DOCUMENT, encodeListCursor }
export type { RevisionListItem }

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

/** The entity fields of an article's snapshot */
export const articleEntity = (article: Pick<ArticleDetail, 'coverMediaId' | 'tagIds'>): SnapshotEntity<'article'> => ({ coverMediaId: article.coverMediaId, tagIds: article.tagIds })

/** The article and its working copies; 404 for a missing or deleted one */
export async function getArticle(db: Db, id: string): Promise<ArticleDetail> {
  const article = await findArticle(db, id)
  if (!article) {
    throw createAppError('not_found')
  }
  return detailOf(article, await findLocalizations(db, 'article', [id]))
}

export async function listArticles(db: Db, filters: ArticleFilters, cursor: string | undefined, limit: number) {
  const rows = await listArticleRows(db, filters, cursor === undefined ? undefined : decodeListCursor(cursor), limit)
  const page = rows.slice(0, limit)
  const localizations = await findLocalizations(db, 'article', page.map(row => row.article.id))
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

/** A new draft with its pt-BR working copy; the slug comes from the title, with -2, -3… when it is taken */
export async function createArticle(db: Db, userId: string, title: string): Promise<ArticleDetail> {
  const slug = await freeSlug(db, 'article', title, FALLBACK_SLUG)
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

async function assertTopics(db: Db, tagIds: readonly string[] | undefined): Promise<void> {
  if (!tagIds || tagIds.length === 0) {
    return
  }
  const found = await existingTagIds(db, tagIds, 'topic')
  const missing = tagIds.filter(id => !found.has(id))
  if (missing.length > 0) {
    throw createAppError('bad_request', 'Invalid input', missing.map(id => ({ path: 'tagIds', message: `topic ${id} does not exist` })))
  }
}

const entityColumns = (entity: SnapshotEntity<'article'>, featured?: boolean) => ({
  coverMediaId: entity.coverMediaId,
  draftTagIds: entity.tagIds,
  ...(featured === undefined ? {} : { featured }),
})

/**
 * Saves the pt-BR working copy and the entity fields. 409 with path "version" when the copy changed since the
 * editor read it, and with path "slug" when another article of the locale has the slug
 */
export async function updateArticle(db: Db, userId: string, article: ArticleDetail, input: ArticleUpdate): Promise<ArticleDetail> {
  const current = sourceCopyOf(article.localizations)
  await assertSavable(db, 'article', current, input)
  await assertTopics(db, input.tagIds)

  const { version, featured, coverMediaId, tagIds, ...localized } = input
  const fields = Object.fromEntries(Object.entries(localized).filter(([, value]) => value !== undefined)) as Partial<ArticleLocalizationRow>
  const entity = { coverMediaId: coverMediaId === undefined ? article.coverMediaId : coverMediaId, tagIds: tagIds ?? article.tagIds }
  await assertMedia(db, { images: { coverMediaId: input.coverMediaId, ogImageMediaId: input.ogImageMediaId }, body: input.body ? { ...current, ...fields }.body : undefined })
  await writeWorkingCopy(db, 'article', userId, article.id, current, { version, fields, entity, entityColumns: entityColumns(entity, featured), kind: 'autosave' })
  return getArticle(db, article.id)
}

/** The pt-BR history, newest first, without snapshots */
export function listArticleRevisions(db: Db, article: ArticleDetail): Promise<RevisionListItem[]> {
  return listSourceRevisions(db, 'article', sourceCopyOf(article.localizations).id)
}

/** One pt-BR revision with its snapshot; 404 for a revision of another article or locale */
export function getArticleRevision(db: Db, article: ArticleDetail, revisionId: string) {
  return getSourceRevision(db, 'article', sourceCopyOf(article.localizations).id, revisionId)
}

/**
 * A named version of the working copy as the editor last saved it (decision 3: a repeat of the latest manual version
 * with the same note is dropped). 409 on "version" when the copy changed since
 */
export function saveArticleVersion(db: Db, userId: string, article: ArticleDetail, input: { version: number, note: string | null }): Promise<{ revision: RevisionListItem, created: boolean }> {
  return saveSourceVersion(db, 'article', {
    userId,
    entityId: article.id,
    current: sourceCopyOf(article.localizations),
    entity: articleEntity(article),
    version: input.version,
    note: input.note,
    reload: async () => sourceCopyOf((await getArticle(db, article.id)).localizations),
  })
}

/**
 * Copies a pt-BR revision back into the working copy (title, slug, excerpt, body, SEO, cover and topics) and records
 * a `restore` revision; nothing is deleted. Topics deleted since are left out. 409 on "version" when the copy
 * changed since the editor read it, on "slug" when another article took the slug meanwhile
 */
export async function restoreArticleRevision(db: Db, userId: string, article: ArticleDetail, input: { version: number, revisionId: string }): Promise<{ article: ArticleDetail, restored: number }> {
  const current = sourceCopyOf(article.localizations)
  const revision = await restorableRevision(db, 'article', current, input)
  const { localization, entity } = revision.snapshot
  const topics = await existingTagIds(db, entity.tagIds, 'topic')
  const restored = { coverMediaId: entity.coverMediaId, tagIds: entity.tagIds.filter(id => topics.has(id)) }
  await writeWorkingCopy(db, 'article', userId, article.id, current, {
    version: input.version,
    fields: localization,
    entity: restored,
    entityColumns: entityColumns(restored),
    kind: 'restore',
  })
  return { article: await getArticle(db, article.id), restored: revision.number }
}

/** Soft delete; the slug is free again. A published article is unpublished first (F06-T4) */
export async function deleteArticle(db: Db, userId: string, article: ArticleDetail): Promise<void> {
  if (article.localizations.some(item => item.publishedRevisionId !== null)) {
    throw createAppError('conflict', 'Unpublish the article first', [{ path: 'status', message: 'published' }])
  }
  await db.batch(softDeleteStatements(db, 'article', article.id, userId))
}
