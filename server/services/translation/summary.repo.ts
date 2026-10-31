// Translation pending work for the dashboard (F09-T1): per entity type and locale, how many translations each state
// has, and how many items the site shows in pt-BR (the base, so "missing" is the base minus the rows that exist).
// Only what is on the site counts: published content, topics, informative images with a pt-BR alt, settings with
// a pt-BR text; drafts are not pending translation work yet
import { and, count, eq, exists, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, TranslationState } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { media, mediaLocalizations } from '../../db/schema/media.ts'
import { siteSettingLocalizations } from '../../db/schema/settings.ts'
import { tagLocalizations, tags } from '../../db/schema/taxonomy.ts'
import { contentTables } from '../content/content-tables.ts'
import type { ContentTables } from '../content/content-tables.ts'

export const SUMMARY_ENTITIES = ['article', 'project', 'page', 'tag', 'media', 'setting'] as const
export type SummaryEntity = (typeof SUMMARY_ENTITIES)[number]

export interface StateCount {
  locale: Locale
  translationState: TranslationState
  count: number
}

const tablesOf = (type: 'article' | 'project' | 'page') => contentTables[type] as unknown as ContentTables['article']

function contentQueries(db: Db, type: 'article' | 'project' | 'page') {
  const { localizations, localizationEntityId } = tablesOf(type)
  const source = alias(localizations, 'source')
  const sourceEntityId = (source as unknown as Record<string, typeof localizationEntityId>)[contentTables[type].entityKey]!
  const published = exists(db.select({ one: sql`1` }).from(source).where(and(
    eq(sourceEntityId, localizationEntityId),
    eq(source.locale, SOURCE_LOCALE),
    isNotNull(source.publishedRevisionId),
    isNull(source.deletedAt),
  )))
  return [
    db.select({ count: count() }).from(localizations)
      .where(and(eq(localizations.locale, SOURCE_LOCALE), isNotNull(localizations.publishedRevisionId), isNull(localizations.deletedAt))),
    db.select({ locale: localizations.locale, translationState: localizations.translationState, count: count() }).from(localizations)
      .where(and(ne(localizations.locale, SOURCE_LOCALE), isNull(localizations.deletedAt), published))
      .groupBy(localizations.locale, localizations.translationState),
  ] as const
}

const informativeImage = (db: Db) => exists(db.select({ one: sql`1` }).from(media).where(and(
  eq(media.id, mediaLocalizations.mediaId),
  eq(media.kind, 'image'),
  eq(media.status, 'ready'),
  eq(media.decorative, false),
)))

/** Every query in one batch: for each entity, the base and the counts by locale and state */
export async function translationCounts(db: Db): Promise<Record<SummaryEntity, { base: number, states: StateCount[] }>> {
  const queries = [
    ...contentQueries(db, 'article'),
    ...contentQueries(db, 'project'),
    ...contentQueries(db, 'page'),
    db.select({ count: count() }).from(tags),
    db.select({ locale: tagLocalizations.locale, translationState: tagLocalizations.translationState, count: count() }).from(tagLocalizations)
      .where(ne(tagLocalizations.locale, SOURCE_LOCALE)).groupBy(tagLocalizations.locale, tagLocalizations.translationState),
    db.select({ count: count() }).from(mediaLocalizations)
      .where(and(eq(mediaLocalizations.locale, SOURCE_LOCALE), ne(mediaLocalizations.alt, ''), informativeImage(db))),
    db.select({ locale: mediaLocalizations.locale, translationState: mediaLocalizations.translationState, count: count() }).from(mediaLocalizations)
      .where(and(ne(mediaLocalizations.locale, SOURCE_LOCALE), informativeImage(db))).groupBy(mediaLocalizations.locale, mediaLocalizations.translationState),
    db.select({ count: count() }).from(siteSettingLocalizations).where(eq(siteSettingLocalizations.locale, SOURCE_LOCALE)),
    db.select({ locale: siteSettingLocalizations.locale, translationState: siteSettingLocalizations.translationState, count: count() }).from(siteSettingLocalizations)
      .where(ne(siteSettingLocalizations.locale, SOURCE_LOCALE)).groupBy(siteSettingLocalizations.locale, siteSettingLocalizations.translationState),
  ]
  const results = await db.batch(queries as unknown as [typeof queries[number], ...typeof queries[number][]]) as unknown[][]
  return Object.fromEntries(SUMMARY_ENTITIES.map((entity, index) => [entity, {
    base: Number((results[index * 2]?.[0] as { count?: number } | undefined)?.count ?? 0),
    states: (results[index * 2 + 1] as StateCount[]).map(row => ({ ...row, count: Number(row.count) })),
  }])) as Record<SummaryEntity, { base: number, states: StateCount[] }>
}
