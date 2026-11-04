// Translation tables (F09-T2, data-model §7). The glossary: a pt-BR term with its translation per locale (null =
// every locale), or marked never to translate (sent as a protected placeholder, ADR-0009 §3). translation_jobs arrives
// with the AI provider (F09-T3)
import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { LOCALES } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { now } from '../../../shared/utils/time.ts'
import { users } from './auth.ts'

export const glossaryTerms = sqliteTable('glossary_terms', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  term: text().notNull(),
  locale: text({ enum: LOCALES }),
  translation: text(),
  doNotTranslate: integer({ mode: 'boolean' }).notNull().default(false),
  caseSensitive: integer({ mode: 'boolean' }).notNull().default(false),
  note: text(),
  createdBy: text().references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now),
  updatedBy: text().references(() => users.id, { onDelete: 'set null' }),
  updatedAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now).$onUpdateFn(now),
}, table => [
  // One entry per term and locale, whatever the case; "every locale" counts as one locale
  // (one expression without commas: drizzle-kit splits index expressions on them)
  uniqueIndex('glossary_terms_term_locale_unique').on(sql`lower(${table.term} || '|' || CASE WHEN ${table.locale} IS NULL THEN '*' ELSE ${table.locale} END)`),
  // A term is either kept as it is or translated, never both, never neither
  check('glossary_terms_kind_check', sql`(${table.doNotTranslate} = 1 AND ${table.translation} IS NULL) OR (${table.doNotTranslate} = 0 AND ${table.translation} IS NOT NULL)`),
  check('glossary_terms_locale_check', sql`${table.locale} IS NULL OR ${table.locale} <> 'pt-BR'`),
])
