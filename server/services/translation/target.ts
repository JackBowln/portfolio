// The translated copy of a content item in one locale (F09-T4): loading the pt-BR source with it, reading its
// segments as review text, and the one write every change goes through (an AI job, a review save). A translation is
// always rebuilt on the CURRENT source structure (decision 2): a block new in the source comes in with its pt-BR text
// and is flagged `missing` until someone translates it; a block gone from the source leaves the translation. Each
// write records a revision of the translation, the base of the review's "before" text (decision 4)
import { and, eq, exists, sql } from 'drizzle-orm'
import { contentHash } from '../../../shared/content/canonical-json.ts'
import type { DocumentJson } from '../../../shared/content/document-schema.ts'
import { deriveDocument } from '../../../shared/content/derive.ts'
import { hashSegments } from '../../../shared/content/segment-hash.ts'
import type { SegmentsMeta } from '../../../shared/content/segment-hash.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import type { ContentType } from '../../../shared/content/snapshot.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, PageKey, TranslationState } from '../../../shared/types/enums.ts'
import { slugify } from '../../../shared/utils/slugify.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { pages } from '../../db/schema/content.ts'
import { createAppError } from '../../utils/errors.ts'
import { articleEntity, getArticle } from '../content/articles.service.ts'
import { contentTables } from '../content/content-tables.ts'
import type { ContentTables } from '../content/content-tables.ts'
import { createLocalization } from '../content/localized.repo.ts'
import { insertPageLocalization } from '../content/pages.repo.ts'
import { getPage } from '../content/pages.service.ts'
import { getProject, projectEntity } from '../content/projects.service.ts'
import { createRevision, insertRevisionStatement, prepareRevision } from '../content/revisions.repo.ts'
import { freeSlug } from '../content/working-copy.ts'
import { isSlugTaken } from '../content/working-copy.repo.ts'
import { segmentSource } from './source.ts'
import { contentSegments } from './state.repo.ts'

export type TranslatableType = 'article' | 'project' | 'page'

type Copy = Record<string, unknown> & { id: string, version: number, workingHash: string, translationState: TranslationState, segmentsMeta: SegmentsMeta, slug?: string, status: string }

export interface LoadedSource {
  type: TranslatableType
  entityId: string
  copy: Copy
  target: Copy | undefined
  entity: object
  /** A page's key, for its admin and publish routes */
  pageKey?: PageKey | undefined
}

const refused = (path: string, message: string) => createAppError('conflict', 'Cannot translate', [{ path, message }])
const tablesOf = (type: ContentType) => contentTables[type] as unknown as ContentTables['article']

export async function loadSource(db: Db, type: TranslatableType, entityId: string, locale: Locale): Promise<LoadedSource> {
  let localizations: { locale: Locale }[]
  let entity: object
  let pageKey: PageKey | undefined
  if (type === 'article') {
    const item = await getArticle(db, entityId)
    localizations = item.localizations
    entity = articleEntity(item)
  }
  else if (type === 'project') {
    const item = await getProject(db, entityId)
    localizations = item.localizations
    entity = projectEntity(item)
  }
  else {
    const [row] = await db.select({ key: pages.key }).from(pages).where(eq(pages.id, entityId))
    if (!row) {
      throw createAppError('not_found')
    }
    pageKey = row.key
    localizations = (await getPage(db, row.key)).localizations
    entity = {}
  }
  const copy = localizations.find(item => item.locale === SOURCE_LOCALE) as Copy | undefined
  if (!copy) {
    throw createAppError('not_found')
  }
  return { type, entityId, copy, target: localizations.find(item => item.locale === locale) as Copy | undefined, entity, pageKey }
}

/** The segment F09-T1 tracks for a review segment: its field, or its top-level block */
export const topOf = (id: string) => id.split('/')[0]!

/** The translation's segments as review text (term-free tags), only where they still fit the source's tags */
export function reviewTexts(source: LoadedSource): Record<string, string> {
  if (!source.target) {
    return {}
  }
  const segmented = segmentSource(source.type, source.copy, [])
  const own = segmentSource(source.type, source.target, [])
  return Object.fromEntries(own.segments.filter(segment => segmented.accepts(segment.id, segment.text)).map(segment => [segment.id, segment.text]))
}

export interface TranslationWrite {
  /** Review texts by segment id; a segment without one keeps the source text, and its block is `missing` */
  texts: Readonly<Record<string, string>>
  state: TranslationState
  /** The meta state of the blocks whose segments all have a text (unchanged blocks keep their meta otherwise) */
  touched: ReadonlySet<string>
  touchedState: SegmentsMeta[string]['state']
  slug?: string | undefined
  userId: string | null
  kind: 'ai' | 'autosave'
}

/**
 * The segments meta after a write, block by block: a block with a segment and no text is `missing`; a touched block
 * gets the current source hash and `touchedState`; any other keeps what it had, or the current hash when new
 */
async function metaAfter(source: LoadedSource, texts: Readonly<Record<string, string>>, write: TranslationWrite): Promise<SegmentsMeta> {
  const hashes = await hashSegments(contentSegments(source.type, source.copy))
  const segments = segmentSource(source.type, source.copy, []).segments
  const meta: SegmentsMeta = {}
  for (const [top, sourceHash] of Object.entries(hashes)) {
    const inner = segments.filter(segment => topOf(segment.id) === top)
    const previous = source.target?.segmentsMeta[top]
    if (inner.some(segment => texts[segment.id] === undefined)) {
      meta[top] = { sourceHash: previous?.sourceHash ?? '', state: 'missing' }
    }
    else if (write.touched.has(top) || !previous) {
      meta[top] = { sourceHash, state: write.touchedState }
    }
    else {
      meta[top] = previous
    }
  }
  return meta
}

/** Writes the translation in one guarded batch with its revision; 409 when it changed since it was read */
export async function writeTranslation(db: Db, source: LoadedSource, locale: Locale, write: TranslationWrite): Promise<void> {
  const { type } = source
  const { values } = segmentSource(type, source.copy, []).rebuild(write.texts)
  const segmentsMeta = await metaAfter(source, write.texts, write)
  const body = type === 'page' ? undefined : deriveDocument(values.body as DocumentJson, locale)
  const fields: Record<string, unknown> = {
    ...values,
    ...(body ? { wordCount: body.wordCount, readingTimeMin: body.readingTimeMin, toc: body.toc } : {}),
    seoTitle: values.seoTitle ?? null,
    seoDescription: values.seoDescription ?? null,
    translationState: write.state,
    segmentsMeta,
    updatedBy: write.userId,
  }

  if (type !== 'page' && write.slug !== undefined) {
    const slug = slugify(write.slug)
    if (!slug) {
      throw createAppError('bad_request', 'Invalid input', [{ path: 'slug', message: 'invalid' }])
    }
    if (await isSlugTaken(db, type, locale, slug, source.target?.id ?? '')) {
      throw createAppError('conflict', 'Slug already used', [{ path: 'slug', message: 'slug_taken' }])
    }
    fields.slug = slug
  }

  if (source.target) {
    const target = source.target
    const next = { ...target, ...fields }
    const snapshot = snapshotOf(type, source.entity as never, next)
    const workingHash = await contentHash(snapshot)
    const { localizations } = tablesOf(type)
    const revision = await prepareRevision(type, { localizationId: target.id, entityId: source.entityId, locale, kind: write.kind, snapshot: snapshot as never, createdBy: write.userId })
    const saved = exists(db.select({ one: sql`1` }).from(localizations).where(and(eq(localizations.id, target.id), eq(localizations.version, target.version + 1), eq(localizations.workingHash, workingHash))))
    const [updated] = await db.batch([
      db.update(localizations).set({ ...fields, workingHash, version: target.version + 1 } as never)
        .where(and(eq(localizations.id, target.id), eq(localizations.version, target.version))).returning({ id: localizations.id }),
      insertRevisionStatement(db, type, revision, saved),
    ])
    if (updated.length === 0) {
      throw refused('version', 'stale')
    }
    return
  }

  let id: string
  let snapshot: unknown
  if (type === 'page') {
    const row = { id: uuidv7(), pageId: String(source.copy.pageId), locale, ...fields }
    snapshot = snapshotOf('page', {}, row)
    await insertPageLocalization(db, { ...row, workingHash: await contentHash(snapshot) } as never)
    id = row.id
  }
  else {
    const entityKey = contentTables[type].entityKey
    const slug = (fields.slug as string | undefined) ?? await freeSlug(db, type, String(values.title ?? ''), String(source.copy.slug ?? 'item'), locale)
    const created = await createLocalization(db, type, { [entityKey]: source.copy[entityKey], locale, ...fields, slug } as never, source.entity as never)
    id = created.id
    snapshot = snapshotOf(type, source.entity as never, created)
  }
  await createRevision(db, type, { localizationId: id, entityId: source.entityId, locale, kind: write.kind, snapshot: snapshot as never, createdBy: write.userId })
}
