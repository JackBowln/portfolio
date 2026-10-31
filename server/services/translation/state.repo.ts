// Translation state writes of articles, projects and pages (F09-T1): the translations a source save makes outdated,
// written in the save's own batch, each guarded by the save having taken effect and by the translation's own version
// (a translation edited in between keeps its edit and is compared again on the next save)
import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { articleSegments, pageSegments, projectSegments } from '../../../shared/content/segment-hash.ts'
import type { Segments, SegmentsMeta } from '../../../shared/content/segment-hash.ts'
import type { ContentType } from '../../../shared/content/snapshot.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { TranslationState } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { contentTables } from '../content/content-tables.ts'
import type { ContentTables } from '../content/content-tables.ts'
import type { OutdatedTranslation, TrackedTranslation } from './state.service.ts'

const tablesOf = (type: ContentType) => contentTables[type] as unknown as ContentTables['article']

/** A localization's id and the version it was read at */
export interface CopyKey {
  id: string
  version: number
}

export function contentSegments(type: ContentType, copy: object): Segments {
  const row = copy as Record<string, never>
  if (type === 'article') {
    return articleSegments(row)
  }
  return type === 'project' ? projectSegments(row) : pageSegments(row)
}

/** The translations of an entity that follow its source (approved or outdated) */
export async function findTrackedTranslations(db: Db, type: ContentType, entityId: string): Promise<TrackedTranslation<CopyKey>[]> {
  const { localizations, localizationEntityId } = tablesOf(type)
  const rows = await db.select({ id: localizations.id, version: localizations.version, translationState: localizations.translationState, segmentsMeta: localizations.segmentsMeta })
    .from(localizations)
    .where(and(eq(localizationEntityId, entityId), ne(localizations.locale, SOURCE_LOCALE), inArray(localizations.translationState, ['approved', 'outdated']), isNull(localizations.deletedAt)))
  return rows.map(row => ({ key: { id: row.id, version: row.version }, translationState: row.translationState as TranslationState, segmentsMeta: row.segmentsMeta as SegmentsMeta }))
}

/** Marks the translations outdated, once `saved` holds; the version moves, so an open editor of that copy reloads */
export function outdatedStatements(db: Db, type: ContentType, items: readonly OutdatedTranslation<CopyKey>[], saved: SQL) {
  const { localizations } = tablesOf(type)
  return items.map(item => db.update(localizations)
    .set({ translationState: 'outdated', segmentsMeta: item.meta, version: item.key.version + 1 })
    .where(and(eq(localizations.id, item.key.id), eq(localizations.version, item.key.version), saved)))
}
