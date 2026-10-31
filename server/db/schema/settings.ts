import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { z } from 'zod'
import { segmentsMeta } from '../../../shared/content/snapshot.ts'
import { LOCALES, SITE_SETTING_KEYS, TRANSLATION_STATES } from '../../../shared/types/enums.ts'
import { now } from '../../../shared/utils/time.ts'
import { zodJson } from '../columns.ts'

// Per-key schemas (shared/settings/) arrive with the settings screen in F08; until then any JSON value
const settingValue = z.json()

export const siteSettings = sqliteTable('site_settings', {
  key: text({ enum: SITE_SETTING_KEYS }).primaryKey(),
  value: zodJson(settingValue)().notNull(),
  version: integer().notNull().default(1),
  // FK to users is added with the auth tables (F03)
  updatedBy: text(),
  updatedAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now),
})

export const siteSettingLocalizations = sqliteTable('site_setting_localizations', {
  key: text({ enum: SITE_SETTING_KEYS }).notNull().references(() => siteSettings.key, { onDelete: 'cascade' }),
  locale: text({ enum: LOCALES }).notNull(),
  value: zodJson(settingValue)().notNull(),
  translationState: text({ enum: TRANSLATION_STATES }).notNull(),
  // Source hash per segment at approval (F09-T1): which fields went outdated when the pt-BR original changed
  segmentsMeta: zodJson(segmentsMeta)().notNull().default(sql`'{}'`),
  updatedAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now),
}, table => [primaryKey({ columns: [table.key, table.locale] })])
