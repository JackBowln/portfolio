// site_settings and site_setting_localizations (F08-T1, data-model §6): reads by key, and one save as a guarded batch
// (the global value moves only from the version read, and each translation is written only if that move happened)
import { and, eq, exists, inArray, sql } from 'drizzle-orm'
import type { SegmentsMeta } from '../../../shared/content/segment-hash.ts'
import type { Locale, SiteSettingKey, TranslationState } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { siteSettingLocalizations, siteSettings } from '../../db/schema/settings.ts'

export type SettingRow = typeof siteSettings.$inferSelect
export type SettingLocalizationRow = typeof siteSettingLocalizations.$inferSelect

export async function findSettings(db: Db, keys: readonly SiteSettingKey[]): Promise<SettingRow[]> {
  return db.select().from(siteSettings).where(inArray(siteSettings.key, [...keys]))
}

export async function findSettingLocalizations(db: Db, keys: readonly SiteSettingKey[], locales?: readonly Locale[]): Promise<SettingLocalizationRow[]> {
  return db.select().from(siteSettingLocalizations)
    .where(and(inArray(siteSettingLocalizations.key, [...keys]), locales ? inArray(siteSettingLocalizations.locale, [...locales]) : undefined))
}

export interface SettingWrite {
  key: SiteSettingKey
  /** The version read; 0 when the key has no row yet */
  version: number
  value: unknown
  userId: string
  now: Date
  /** Locales to write (a value) or remove (null) */
  localizations: { locale: Locale, value: unknown, state: TranslationState, meta?: SegmentsMeta | undefined }[]
  /** Translations the pt-BR change makes outdated (F09-T1) */
  outdated?: { locale: Locale, meta: SegmentsMeta }[] | undefined
}

/**
 * One save: the global row (insert at version 1, or update from the version read), then each translation, guarded by
 * "the row now has version + 1, written by this user at this instant", so a save that lost the race changes nothing.
 * The first result is the written row, empty on a conflict
 */
export function saveSettingStatements(db: Db, write: SettingWrite) {
  const next = write.version + 1
  const done = exists(db.select({ one: sql`1` }).from(siteSettings).where(and(
    eq(siteSettings.key, write.key),
    eq(siteSettings.version, next),
    eq(siteSettings.updatedBy, write.userId),
    eq(siteSettings.updatedAt, write.now),
  )))
  const head = write.version === 0
    ? db.insert(siteSettings).values({ key: write.key, value: write.value as never, version: 1, updatedBy: write.userId, updatedAt: write.now })
        .onConflictDoNothing().returning({ version: siteSettings.version })
    : db.update(siteSettings).set({ value: write.value as never, version: next, updatedBy: write.userId, updatedAt: write.now })
        .where(and(eq(siteSettings.key, write.key), eq(siteSettings.version, write.version))).returning({ version: siteSettings.version })
  const translations = write.localizations.map(({ locale, value, state, meta }) => value === null
    ? db.delete(siteSettingLocalizations).where(and(eq(siteSettingLocalizations.key, write.key), eq(siteSettingLocalizations.locale, locale), done))
    : db.insert(siteSettingLocalizations).select(db.select({
        key: sql<SiteSettingKey>`${write.key}`.as('key'),
        locale: sql<Locale>`${locale}`.as('locale'),
        value: sql<string>`${JSON.stringify(value)}`.as('value'),
        translationState: sql<TranslationState>`${state}`.as('translation_state'),
        segmentsMeta: sql<string>`${JSON.stringify(meta ?? {})}`.as('segments_meta'),
        updatedAt: sql<number>`${write.now.getTime()}`.as('updated_at'),
      } as never).from(sql`(SELECT 1)`).where(done)).onConflictDoUpdate({
        target: [siteSettingLocalizations.key, siteSettingLocalizations.locale],
        set: { value: sql`excluded.value`, translationState: sql`excluded.translation_state`, segmentsMeta: sql`excluded.segments_meta`, updatedAt: sql`excluded.updated_at` },
      }))
  const outdated = (write.outdated ?? []).map(item => db.update(siteSettingLocalizations)
    .set({ translationState: 'outdated', segmentsMeta: item.meta })
    .where(and(eq(siteSettingLocalizations.key, write.key), eq(siteSettingLocalizations.locale, item.locale), done)))
  return [head, ...translations, ...outdated] as const
}
