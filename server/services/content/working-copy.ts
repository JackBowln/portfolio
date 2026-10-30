// The pt-BR working copy of articles and projects (F06-T1, F06-T2, F07-T1): a free slug for a new item, the save
// batch guarded by the version the editor read (with its autosave or restore revision), the history and named
// versions. The services of each type (articles.service.ts, projects.service.ts) say which entity fields a save
// writes and which media it uses; the rules here are the same for both
import { contentHash } from '../../../shared/content/canonical-json.ts'
import { CURRENT_SCHEMA_VERSION } from '../../../shared/content/document-schema.ts'
import type { DocumentJson } from '../../../shared/content/document-schema.ts'
import { deriveDocument } from '../../../shared/content/derive.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import type { Snapshot, SnapshotEntity, SnapshotInput, SluggedContentType } from '../../../shared/content/snapshot.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, RevisionKind } from '../../../shared/types/enums.ts'
import { MAX_SLUG_LENGTH, slugify } from '../../../shared/utils/slugify.ts'
import type { Db } from '../../db/client.ts'
import { createAppError, isUniqueViolation } from '../../utils/errors.ts'
import { findMediaStates } from '../media/media.repo.ts'
import type { LocalizationRow } from './localized.repo.ts'
import type { RevisionMeta } from './revisions.repo.ts'
import { getRevision, insertRevisionStatement, listRevisions, prepareRevision, userNames } from './revisions.repo.ts'
import type { MediaUse } from './working-copy.repo.ts'
import { copyAtVersion, isSlugTaken, saveStatements, takenSlugs } from './working-copy.repo.ts'

export const EMPTY_DOCUMENT: DocumentJson = { type: 'doc', attrs: { schemaVersion: CURRENT_SCHEMA_VERSION }, content: [] }

export const slugConflict = () => createAppError('conflict', 'Slug already used', [{ path: 'slug', message: 'slug_taken' }])
export const versionConflict = (type: SluggedContentType) => createAppError('conflict', `The ${type} changed since it was opened`, [{ path: 'version', message: 'stale' }])

export function sourceCopyOf<R extends { locale: Locale }>(localizations: readonly R[]): R {
  const current = localizations.find(item => item.locale === SOURCE_LOCALE)
  if (!current) {
    throw createAppError('not_found')
  }
  return current
}

/** A pt-BR slug from the title, with -2, -3… when it is taken; `fallback` when the title has no letter or digit */
export async function freeSlug(db: Db, type: SluggedContentType, title: string, fallback: string): Promise<string> {
  const base = slugify(title, MAX_SLUG_LENGTH - 4) || fallback
  const taken = await takenSlugs(db, type, SOURCE_LOCALE, base)
  let slug = base
  for (let n = 2; taken.has(slug); n++) {
    slug = `${base}-${n}`
  }
  return slug
}

/**
 * Media a save points at: each image field (cover, og…) and gallery item must be a ready image, and every media the
 * body uses must exist. 400 with the field of each problem
 */
export async function assertMedia(db: Db, input: { images: Record<string, string | null | undefined>, gallery?: readonly string[] | undefined, body?: DocumentJson | undefined }): Promise<void> {
  const images = Object.entries(input.images).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  const gallery = input.gallery ?? []
  const bodyIds = input.body ? deriveDocument(input.body, SOURCE_LOCALE).mediaUsages.map(use => use.mediaId) : []
  const ids = [...images.map(([, id]) => id), ...gallery, ...bodyIds]
  if (ids.length === 0) {
    return
  }
  const states = await findMediaStates(db, ids)
  const readyImage = (mediaId: string) => {
    const state = states.get(mediaId)
    return state?.kind === 'image' && state.status === 'ready'
  }
  const issues: { path: string, message: string }[] = []
  for (const [field, mediaId] of images) {
    if (!readyImage(mediaId)) {
      issues.push({ path: field, message: 'must be a ready image' })
    }
  }
  for (const mediaId of new Set(gallery)) {
    if (!readyImage(mediaId)) {
      issues.push({ path: 'galleryMediaIds', message: `media ${mediaId} must be a ready image` })
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

export interface CopyWrite<T extends SluggedContentType> {
  version: number
  fields: Partial<LocalizationRow<T>>
  /** The entity fields of the snapshot (cover, topics or technologies…) */
  entity: SnapshotEntity<T>
  /** The entity columns the save writes */
  entityColumns: Record<string, unknown>
  /** Uses besides the body, the cover and the og image (a project's gallery) */
  extraUses?: readonly MediaUse[] | undefined
  /** The revision the write records: every save is an autosave (deduplicated), a restore always records */
  kind: 'autosave' | 'restore'
}

/**
 * Writes the working copy, derived data, entity fields, media uses and the write's revision in one batch guarded by
 * the version (working-copy.repo.ts, saveStatements). 409 on "version" when it changed, on "slug" when taken
 */
export async function writeWorkingCopy<T extends SluggedContentType>(db: Db, type: T, userId: string, entityId: string, current: LocalizationRow<T>, write: CopyWrite<T>): Promise<void> {
  const next = { ...current, ...write.fields } as LocalizationRow<T>
  const derived = deriveDocument(next.body, SOURCE_LOCALE)
  const snapshot = snapshotOf(type, write.entity, next)
  const workingHash = await contentHash(snapshot)
  const uses: MediaUse[] = [
    ...derived.mediaUsages.map(use => ({ mediaId: use.mediaId, locale: SOURCE_LOCALE, context: use.context })),
    ...(write.entity.coverMediaId ? [{ mediaId: write.entity.coverMediaId, locale: null, context: 'cover' as const }] : []),
    ...(write.extraUses ?? []),
    ...(next.ogImageMediaId ? [{ mediaId: next.ogImageMediaId, locale: SOURCE_LOCALE, context: 'og' as const }] : []),
  ]
  const revision = await prepareRevision(type, { localizationId: current.id, entityId, locale: SOURCE_LOCALE, kind: write.kind, snapshot: snapshot as SnapshotInput<T>, createdBy: userId })

  let updated: { id: string }[]
  try {
    [updated] = await db.batch(saveStatements(db, type, {
      entityId,
      localizationId: current.id,
      version: write.version,
      workingHash,
      localization: { ...write.fields, wordCount: derived.wordCount, readingTimeMin: derived.readingTimeMin, toc: derived.toc, updatedBy: userId },
      entity: { ...write.entityColumns, updatedBy: userId },
      uses,
      revision,
    }))
  }
  catch (error) {
    throw isUniqueViolation(error) ? slugConflict() : error
  }
  if (updated.length === 0) {
    throw versionConflict(type)
  }
}

/** The checks every save does first: the version the editor read, and a free slug when it changes */
export async function assertSavable<T extends SluggedContentType>(db: Db, type: T, current: LocalizationRow<T>, input: { version: number, slug?: string | undefined }): Promise<void> {
  if (current.version !== input.version) {
    throw versionConflict(type)
  }
  if (input.slug !== undefined && input.slug !== current.slug && await isSlugTaken(db, type, SOURCE_LOCALE, input.slug, current.id)) {
    throw slugConflict()
  }
}

export interface ListCursor {
  updatedAt: number
  id: string
}

export function encodeListCursor({ updatedAt, id }: ListCursor): string {
  return btoa(`${updatedAt}:${id}`).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function decodeListCursor(cursor: string): ListCursor {
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

export interface RevisionListItem {
  id: string
  number: number
  kind: RevisionKind
  note: string | null
  authorName: string | null
  createdAt: Date
}

/** The pt-BR history, newest first, without snapshots */
export async function listSourceRevisions(db: Db, type: SluggedContentType, localizationId: string): Promise<RevisionListItem[]> {
  const revisions = await listRevisions(db, type, localizationId)
  const names = await userNames(db, revisions.flatMap(revision => (revision.createdBy ? [revision.createdBy] : [])))
  return revisions.map(({ id, number, kind, note, createdBy, createdAt }) => ({ id, number, kind, note, authorName: createdBy ? names.get(createdBy) ?? null : null, createdAt }))
}

/** One pt-BR revision with its snapshot; 404 for a revision of another item or locale */
export async function getSourceRevision<T extends SluggedContentType>(db: Db, type: T, localizationId: string, revisionId: string) {
  const revision = await getRevision(db, type, localizationId, revisionId)
  if (!revision) {
    throw createAppError('not_found')
  }
  const { contentHash: _hash, createdBy, ...rest } = revision
  const names = await userNames(db, createdBy ? [createdBy] : [])
  return { ...rest, authorName: createdBy ? names.get(createdBy) ?? null : null }
}

const listItemOf = ({ id, number, kind, note, createdAt }: RevisionMeta) => ({ id, number, kind, note, createdAt })

/**
 * A named version of the working copy as the editor last saved it (decision 3: a repeat of the latest manual version
 * with the same note is dropped). 409 on "version" when the copy changed since. `reload` reads the copy again
 */
export async function saveSourceVersion<T extends SluggedContentType>(db: Db, type: T, input: {
  userId: string
  entityId: string
  current: LocalizationRow<T>
  entity: SnapshotEntity<T>
  version: number
  note: string | null
  reload: () => Promise<LocalizationRow<T>>
}): Promise<{ revision: RevisionListItem, created: boolean }> {
  const { current, userId } = input
  if (current.version !== input.version) {
    throw versionConflict(type)
  }
  const snapshot = snapshotOf(type, input.entity, current)
  const prepared = await prepareRevision(type, { localizationId: current.id, entityId: input.entityId, locale: SOURCE_LOCALE, kind: 'manual', snapshot: snapshot as SnapshotInput<T>, note: input.note, createdBy: userId })
  const [inserted] = await insertRevisionStatement(db, type, prepared, copyAtVersion(db, type, current.id, input.version))
  if (inserted) {
    const names = await userNames(db, [userId])
    return { revision: { ...listItemOf(inserted), authorName: names.get(userId) ?? null }, created: true }
  }
  // Not written: either the copy moved on, or this repeats the latest manual version
  if ((await input.reload()).version !== input.version) {
    throw versionConflict(type)
  }
  const [latest] = (await listSourceRevisions(db, type, current.id)).filter(revision => revision.kind === 'manual')
  return { revision: latest!, created: false }
}

/**
 * The revision a restore copies back, after its checks: 409 on "version" when the copy changed since the editor read
 * it, on "slug" when another item took the revision's slug meanwhile, 404 for a revision of another item
 */
export async function restorableRevision<T extends SluggedContentType>(db: Db, type: T, current: LocalizationRow<T>, input: { version: number, revisionId: string }): Promise<RevisionMeta & { snapshot: Snapshot<T> }> {
  if (current.version !== input.version) {
    throw versionConflict(type)
  }
  const revision = await getRevision(db, type, current.id, input.revisionId)
  if (!revision) {
    throw createAppError('not_found')
  }
  const { slug } = revision.snapshot.localization
  if (slug !== current.slug && await isSlugTaken(db, type, SOURCE_LOCALE, slug, current.id)) {
    throw slugConflict()
  }
  return revision
}
