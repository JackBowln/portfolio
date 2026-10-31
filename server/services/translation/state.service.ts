// Translation states (F09-T1, data-model §8, ADR-0009 §7–8). When the pt-BR original is saved, every approved (or
// already outdated) translation compares its segments with the new source: the segments whose source changed become
// `outdated`, and so does the localization, so it cannot be published until someone reviews it. The baseline of a
// segment is the hash it was approved against (segments_meta); a translation approved before segments were tracked
// takes the source as it was right before this save
import { canonicalJson } from '../../../shared/content/canonical-json.ts'
import { approvedMeta, compareSegments, hashSegments } from '../../../shared/content/segment-hash.ts'
import type { Segments, SegmentsMeta } from '../../../shared/content/segment-hash.ts'
import type { PENDING_STATES } from '../../../shared/translation/states.ts'
import { LOCALES, SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, TranslationState } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { SUMMARY_ENTITIES, translationCounts } from './summary.repo.ts'
import type { SummaryEntity } from './summary.repo.ts'

export interface TrackedTranslation<K = string> {
  key: K
  translationState: TranslationState
  segmentsMeta: SegmentsMeta
}

export interface OutdatedTranslation<K = string> {
  key: K
  meta: SegmentsMeta
  changed: string[]
}

/** Only these follow the source; machine and in-review copies are being worked on and get reviewed anyway */
const TRACKED: readonly TranslationState[] = ['approved', 'outdated']

/**
 * The translations a source change makes outdated, with their new meta. Nothing to do (no tracked translation, or no
 * segment changed) → an empty list, without hashing anything when there is no tracked translation
 */
export async function outdatedBySourceChange<K>(previous: Segments, next: Segments, translations: readonly TrackedTranslation<K>[]): Promise<OutdatedTranslation<K>[]> {
  const tracked = translations.filter(item => TRACKED.includes(item.translationState))
  if (tracked.length === 0) {
    return []
  }
  const [before, after] = await Promise.all([hashSegments(previous), hashSegments(next)])
  return tracked.flatMap((item) => {
    const { meta, changed } = compareSegments({ ...approvedMeta(before), ...item.segmentsMeta }, after)
    // An outdated copy whose meta stays the same needs no write on every autosave
    const same = item.translationState === 'outdated' && canonicalJson(meta) === canonicalJson(item.segmentsMeta)
    return changed.length > 0 && !same ? [{ key: item.key, meta, changed }] : []
  })
}

/** The meta a translation gets when approved against this source: every segment approved */
export async function approvalMeta(source: Segments): Promise<SegmentsMeta> {
  return approvedMeta(await hashSegments(source))
}

export interface TranslationSummaryRow {
  entity: SummaryEntity
  /** Per target locale: the pending count of each state; `missing` is what has no translation row at all */
  locales: Record<Locale, Record<(typeof PENDING_STATES)[number], number>>
}

/** Pending translation work per entity type and target locale, for the dashboard */
export async function translationSummary(db: Db): Promise<{ locales: Locale[], rows: TranslationSummaryRow[] }> {
  const counts = await translationCounts(db)
  const locales = LOCALES.filter(locale => locale !== SOURCE_LOCALE)
  const rows = SUMMARY_ENTITIES.map((entity) => {
    const { base, states } = counts[entity]
    return {
      entity,
      locales: Object.fromEntries(locales.map((locale) => {
        const inLocale = states.filter(row => row.locale === locale)
        const of = (state: TranslationState) => inLocale.find(row => row.translationState === state)?.count ?? 0
        const existing = inLocale.reduce((sum, row) => sum + row.count, 0)
        return [locale, { missing: Math.max(0, base - existing), machine: of('machine'), in_review: of('in_review'), outdated: of('outdated') }]
      })) as TranslationSummaryRow['locales'],
    }
  })
  return { locales, rows }
}
