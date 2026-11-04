// The translation review (F09-T4, ADR-0009 §9, RF-11.2): one item in one locale, segment by segment, the source next
// to its translation, with what the translation said before (the previous revision). Saving checks every segment's
// tags against the source and sends the copy to review; approving needs every block translated (decision 3) and
// records the source hashes it was approved against. Publishing stays the publishing routes' job, with their guards
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { approvedMeta, hashSegments } from '../../../shared/content/segment-hash.ts'
import { canTransition } from '../../../shared/translation/states.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, PageKey, TranslationState } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { chunked } from '../../db/in-limit.ts'
import { pages } from '../../db/schema/content.ts'
import { createAppError } from '../../utils/errors.ts'
import { contentTables } from '../content/content-tables.ts'
import type { ContentTables } from '../content/content-tables.ts'
import { getRevision, listRevisions } from '../content/revisions.repo.ts'
import { segmentSource } from './source.ts'
import { contentSegments } from './state.repo.ts'
import { loadSource, reviewTexts, topOf, writeTranslation } from './target.ts'
import type { LoadedSource, TranslatableType } from './target.ts'

export type SegmentStatus = 'ok' | 'outdated' | 'missing'

export interface ReviewSegment {
  id: string
  /** The block (or field) F09-T1 tracks */
  top: string
  source: string
  translation: string | null
  /** The text in the previous revision of the translation, when it differs */
  previous: string | null
  status: SegmentStatus
}

export interface Review {
  type: TranslatableType
  id: string
  locale: Locale
  pageKey: PageKey | null
  title: string
  sourcePublished: boolean
  target: { id: string, version: number, state: TranslationState, status: string, slug: string | null, published: boolean } | null
  segments: ReviewSegment[]
  /** Blocks that still need a translation before approving */
  missing: string[]
}

const conflict = (path: string, message: string) => createAppError('conflict', 'Cannot review', [{ path, message }])
const tablesOf = (type: TranslatableType) => contentTables[type] as unknown as ContentTables['article']

async function previousTexts(db: Db, source: LoadedSource): Promise<Record<string, string>> {
  if (!source.target) {
    return {}
  }
  // The newest revision is the translation as it is now; the one before is what the reviewer compares with
  const [, before] = await listRevisions(db, source.type, source.target.id)
  if (!before) {
    return {}
  }
  const revision = await getRevision(db, source.type, source.target.id, before.id)
  if (!revision) {
    return {}
  }
  return Object.fromEntries(segmentSource(source.type, revision.snapshot.localization as Record<string, unknown>, []).segments.map(segment => [segment.id, segment.text]))
}

function statusOf(source: LoadedSource, id: string, translation: string | undefined): SegmentStatus {
  const state = source.target?.segmentsMeta[topOf(id)]?.state
  if (translation === undefined || state === 'missing') {
    return 'missing'
  }
  return state === 'outdated' ? 'outdated' : 'ok'
}

export async function getReview(db: Db, type: TranslatableType, id: string, locale: Locale): Promise<Review> {
  const source = await loadSource(db, type, id, locale)
  const texts = reviewTexts(source)
  const previous = await previousTexts(db, source)
  const segments = segmentSource(type, source.copy, []).segments.map((segment): ReviewSegment => {
    const translation = texts[segment.id]
    const before = previous[segment.id]
    return {
      id: segment.id,
      top: topOf(segment.id),
      source: segment.text,
      translation: translation ?? null,
      previous: before !== undefined && before !== translation ? before : null,
      status: statusOf(source, segment.id, translation),
    }
  })
  const target = source.target
  return {
    type,
    id,
    locale,
    pageKey: source.pageKey ?? null,
    title: String(source.copy.title ?? source.pageKey ?? id),
    sourcePublished: source.copy.publishedRevisionId !== null && source.copy.publishedRevisionId !== undefined,
    target: target
      ? { id: target.id, version: target.version, state: target.translationState, status: target.status, slug: target.slug ?? null, published: target.publishedRevisionId !== null && target.publishedRevisionId !== undefined }
      : null,
    segments,
    missing: [...new Set(segments.filter(segment => segment.status === 'missing').map(segment => segment.top))],
  }
}

export interface ReviewSave {
  /** The target's version read; 0 when there is no translation yet (writing one by hand) */
  version: number
  segments: Record<string, string>
  slug?: string | undefined
}

/** Saves the reviewer's texts; the translation goes to review. 400 per segment whose tags differ from the source */
export async function saveReview(db: Db, userId: string, type: TranslatableType, id: string, locale: Locale, input: ReviewSave): Promise<Review> {
  const source = await loadSource(db, type, id, locale)
  if ((source.target?.version ?? 0) !== input.version) {
    throw conflict('version', 'stale')
  }
  const state = source.target?.translationState ?? 'missing'
  if (state !== 'in_review' && !canTransition(state, 'in_review')) {
    throw conflict('state', state)
  }
  const segmented = segmentSource(type, source.copy, [])
  const known = new Set(segmented.segments.map(segment => segment.id))
  const issues = Object.entries(input.segments).flatMap(([segmentId, text]) => {
    if (!known.has(segmentId)) {
      return [{ path: `segments.${segmentId}`, message: 'unknown_segment' }]
    }
    return segmented.accepts(segmentId, text) ? [] : [{ path: `segments.${segmentId}`, message: 'tags' }]
  })
  if (issues.length > 0) {
    throw createAppError('bad_request', 'Invalid input', issues)
  }
  const current = reviewTexts(source)
  const changed = Object.entries(input.segments).filter(([segmentId, text]) => current[segmentId] !== text).map(([segmentId]) => segmentId)
  await writeTranslation(db, source, locale, {
    texts: { ...current, ...input.segments },
    state: 'in_review',
    touched: new Set(changed.map(topOf)),
    touchedState: 'in_review',
    slug: input.slug,
    userId,
    kind: 'autosave',
  })
  return getReview(db, type, id, locale)
}

/** Approves the translation as it is: every block translated, the source hashes recorded */
export async function approveTranslation(db: Db, userId: string, type: TranslatableType, id: string, locale: Locale, version: number): Promise<Review> {
  const source = await loadSource(db, type, id, locale)
  const target = source.target
  if (!target) {
    throw createAppError('not_found')
  }
  if (target.version !== version) {
    throw conflict('version', 'stale')
  }
  if (!canTransition(target.translationState, 'approved')) {
    throw conflict('state', target.translationState)
  }
  const review = await getReview(db, type, id, locale)
  if (review.missing.length > 0) {
    throw createAppError('conflict', 'Cannot approve', review.missing.map(top => ({ path: `segments.${top}`, message: 'missing' })))
  }
  const { localizations } = tablesOf(type)
  const updated = await db.update(localizations).set({
    translationState: 'approved',
    segmentsMeta: approvedMeta(await hashSegments(contentSegments(type, source.copy))),
    reviewedBy: userId,
    reviewedAt: new Date(),
    version: target.version + 1,
  }).where(and(eq(localizations.id, target.id), eq(localizations.version, target.version))).returning({ id: localizations.id })
  if (updated.length === 0) {
    throw conflict('version', 'stale')
  }
  return getReview(db, type, id, locale)
}

export interface TranslatableItem {
  type: TranslatableType
  id: string
  title: string
  pageKey: PageKey | null
  /** The state per target locale; `missing` when there is no copy */
  locales: Partial<Record<Locale, TranslationState>>
}

/** Everything on the site in pt-BR that can be translated, with the state of each locale */
export async function listTranslatableItems(db: Db): Promise<TranslatableItem[]> {
  const items: TranslatableItem[] = []
  for (const type of ['article', 'project'] as const) {
    const { localizations, localizationEntityId } = tablesOf(type)
    const sources = await db.select({ id: localizationEntityId, title: localizations.title }).from(localizations)
      .where(and(eq(localizations.locale, SOURCE_LOCALE), isNotNull(localizations.publishedRevisionId), isNull(localizations.deletedAt)))
    const ids = sources.map(row => row.id)
    // In groups under D1's bound parameter limit (server/db/in-limit.ts)
    const copies = (await Promise.all(chunked(ids).map(group => db.select({ id: localizationEntityId, locale: localizations.locale, state: localizations.translationState })
      .from(localizations).where(and(inArray(localizationEntityId, group), isNull(localizations.deletedAt)))))).flat()
    for (const row of sources) {
      items.push({ type, id: row.id, title: row.title, pageKey: null, locales: Object.fromEntries(copies.filter(copy => copy.id === row.id && copy.locale !== SOURCE_LOCALE).map(copy => [copy.locale, copy.state])) })
    }
  }
  const { localizations } = contentTables.page
  const pageRows = await db.select({ id: pages.id, key: pages.key, locale: localizations.locale, state: localizations.translationState, published: localizations.publishedRevisionId })
    .from(localizations).innerJoin(pages, eq(pages.id, localizations.pageId)).where(isNull(localizations.deletedAt))
  for (const row of pageRows.filter(item => item.locale === SOURCE_LOCALE && item.published)) {
    items.push({ type: 'page', id: row.id, title: row.key, pageKey: row.key, locales: Object.fromEntries(pageRows.filter(copy => copy.id === row.id && copy.locale !== SOURCE_LOCALE).map(copy => [copy.locale, copy.state])) })
  }
  return items
}
