// Translation tables (F09-T2, data-model §7). The glossary: a pt-BR term with its translation per locale (null =
// every locale), or marked never to translate (sent as a protected placeholder, ADR-0009 §3). And the ledger of AI
// translation jobs (F09-T3): what each job was estimated to cost, what it used, and the segments done so far
import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { z } from 'zod'
import { LOCALES } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { now } from '../../../shared/utils/time.ts'
import { zodJson } from '../columns.ts'
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

export const TRANSLATION_JOB_STATUSES = ['estimated', 'running', 'succeeded', 'failed', 'cancelled'] as const
// `texts`: a batch of short texts (F09-T5: topic names, media texts, settings), entity id `batch`
export const TRANSLATION_ENTITY_TYPES = ['article', 'project', 'page', 'texts'] as const

// Segments translated so far (id → tagged text) and the ones the provider got wrong; kept so a failed job resumes
// `scope`: the segments a partial job retranslates (F09-T4); absent for a whole translation
const jobResults = z.strictObject({ done: z.record(z.string(), z.string()), failed: z.array(z.string()), scope: z.array(z.string()).optional() })

export const translationJobs = sqliteTable('translation_jobs', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  entityType: text({ enum: TRANSLATION_ENTITY_TYPES }).notNull(),
  entityId: text().notNull(),
  targetLocale: text({ enum: LOCALES }).notNull(),
  // The pt-BR revision the estimate segmented; null when the copy had none yet
  sourceRevisionId: text(),
  // The pt-BR working hash the estimate segmented: a later change makes the job stale (its segments would differ)
  sourceHash: text().notNull(),
  provider: text().notNull(),
  model: text().notNull(),
  status: text({ enum: TRANSLATION_JOB_STATUSES }).notNull().default('estimated'),
  segmentsTotal: integer().notNull(),
  segmentsDone: integer().notNull().default(0),
  estimatedInputTokens: integer().notNull(),
  estimatedOutputTokens: integer().notNull(),
  estimatedNeurons: integer().notNull(),
  estimatedCostMicroUsd: integer().notNull().default(0),
  inputTokens: integer().notNull().default(0),
  outputTokens: integer().notNull().default(0),
  neurons: integer().notNull().default(0),
  costMicroUsd: integer().notNull().default(0),
  // The provider did not report its usage for at least one call; the estimate was recorded instead
  usageEstimated: integer({ mode: 'boolean' }).notNull().default(false),
  results: zodJson(jobResults)().notNull().default(sql`'{"done":{},"failed":[]}'`),
  // Sanitized: a code and a short message, never a provider response or a stack
  error: text(),
  requestedBy: text().references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now),
  startedAt: integer({ mode: 'timestamp_ms' }),
  finishedAt: integer({ mode: 'timestamp_ms' }),
}, table => [
  // The cost guard sums by day and month
  index('translation_jobs_created_at_idx').on(table.createdAt),
  index('translation_jobs_entity_idx').on(table.entityType, table.entityId, table.targetLocale),
])
