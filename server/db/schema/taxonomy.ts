// Topics and technologies (data-model §4.7): one row per tag, one localization per locale with its own slug
import { sql } from 'drizzle-orm'
import { check, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { segmentsMeta } from '../../../shared/content/snapshot.ts'
import { LOCALES, TAG_KINDS, TRANSLATION_STATES } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { now } from '../../../shared/utils/time.ts'
import { zodJson } from '../columns.ts'
import { users } from './auth.ts'

export const tags = sqliteTable('tags', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  kind: text({ enum: TAG_KINDS }).notNull(),
  // Official site of a technology
  url: text(),
  // Icon versioned in the repository
  iconKey: text(),
  createdBy: text().references(() => users.id, { onDelete: 'set null' }),
  updatedBy: text().references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now),
  updatedAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now).$onUpdateFn(now),
}, table => [check('tags_url_check', sql`${table.url} IS NULL OR ${table.url} LIKE 'https://%'`)])

export const tagLocalizations = sqliteTable('tag_localizations', {
  tagId: text().notNull().references(() => tags.id, { onDelete: 'cascade' }),
  locale: text({ enum: LOCALES }).notNull(),
  name: text().notNull(),
  slug: text().notNull(),
  description: text(),
  translationState: text({ enum: TRANSLATION_STATES }).notNull(),
  // Source hash per segment at approval (F09-T1): which fields went outdated when the pt-BR original changed
  segmentsMeta: zodJson(segmentsMeta)().notNull().default(sql`'{}'`),
  updatedAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now).$onUpdateFn(now),
}, table => [
  primaryKey({ columns: [table.tagId, table.locale] }),
  uniqueIndex('tag_localizations_locale_slug_unique').on(table.locale, table.slug),
])
