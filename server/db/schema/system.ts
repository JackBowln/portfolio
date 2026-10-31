import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { z } from 'zod'
import { CONTACT_STATUSES, LOCALES } from '../../../shared/types/enums.ts'
import type { RedirectStatusCode } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { now } from '../../../shared/utils/time.ts'
import { zodJson } from '../columns.ts'

export const redirects = sqliteTable('redirects', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  fromPath: text().notNull().unique('redirects_from_path_unique'),
  toPath: text().notNull(),
  statusCode: integer().$type<RedirectStatusCode>().notNull().default(301),
  locale: text({ enum: LOCALES }),
  // Null for manual redirects; set when a published slug changes (data-model §9.4)
  entityType: text(),
  entityId: text(),
  // FK to users is added with the auth tables (F03)
  createdBy: text(),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now),
}, table => [check('redirects_status_code_check', sql`${table.statusCode} IN (301, 302, 308)`)])

// No secrets or PII in metadata (data-model §6)
const auditMetadata = z.record(z.string(), z.json())

export const auditLog = sqliteTable('audit_log', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  // Null means the system (cron, migrations); FK to users is added in F03
  actorUserId: text(),
  action: text().notNull(),
  entityType: text(),
  entityId: text(),
  locale: text({ enum: LOCALES }),
  metadata: zodJson(auditMetadata)(),
  ipHash: text(),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now),
}, table => [
  index('audit_log_created_at_idx').on(sql`${table.createdAt} DESC`),
  index('audit_log_entity_idx').on(table.entityType, table.entityId),
])

// Contact form messages (F08-T3, data-model §6): personal data, kept 12 months (contact:retention) and deleted for good
// from the inbox; the IP only as an HMAC (ip-hash.ts), never in clear
export const contactMessages = sqliteTable('contact_messages', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  name: text().notNull(),
  email: text().notNull(),
  message: text().notNull(),
  locale: text({ enum: LOCALES }).notNull(),
  status: text({ enum: CONTACT_STATUSES }).notNull().default('new'),
  ipHash: text(),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now),
  readAt: integer({ mode: 'timestamp_ms' }),
}, table => [
  index('contact_messages_status_idx').on(table.status, table.id),
  index('contact_messages_created_at_idx').on(table.createdAt),
])
