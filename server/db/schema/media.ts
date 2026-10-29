// Media library (ADR-0007, data-model §5). A row is `pending` until finalize confirms every upload in R2,
// `ready` after, and `deleted` (soft) when removed; the cron purges R2 objects 30 days later (F06)
import { sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { check, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { z } from 'zod'
import { IMAGE_FORMATS } from '../../../shared/media/schemas.ts'
import type { MediaMimeType } from '../../../shared/media/schemas.ts'
import { LOCALES, MEDIA_KINDS, MEDIA_STATUSES, MEDIA_TRACK_KINDS, MEDIA_USAGE_CONTEXTS, TRANSLATION_STATES } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { now } from '../../../shared/utils/time.ts'
import { zodJson } from '../columns.ts'
import { users } from './auth.ts'

const mediaVariants = z.array(z.object({
  name: z.string(),
  format: z.enum(IMAGE_FORMATS),
  width: z.number().int(),
  height: z.number().int(),
  key: z.string(),
  size: z.number().int(),
}).strict())

export const media = sqliteTable('media', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  kind: text({ enum: MEDIA_KINDS }).notNull(),
  status: text({ enum: MEDIA_STATUSES }).notNull().default('pending'),
  mimeType: text().$type<MediaMimeType>().notNull(),
  originalFilename: text().notNull(),
  sizeBytes: integer().notNull(),
  width: integer(),
  height: integer(),
  durationMs: integer(),
  sha256: text().notNull().unique('media_sha256_unique'),
  originalKey: text().notNull(),
  variants: zodJson(mediaVariants)().notNull(),
  placeholderDataUrl: text(),
  dominantColor: text(),
  focalX: real().notNull().default(0.5),
  focalY: real().notNull().default(0.5),
  // Explicit choice: an empty alt is valid only for decorative images (data-model §5)
  decorative: integer({ mode: 'boolean' }).notNull().default(false),
  posterMediaId: text().references((): AnySQLiteColumn => media.id, { onDelete: 'set null' }),
  createdBy: text().references(() => users.id, { onDelete: 'set null' }),
  updatedBy: text().references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now),
  updatedAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now).$onUpdateFn(now),
  deletedAt: integer({ mode: 'timestamp_ms' }),
}, table => [
  index('media_status_created_idx').on(table.status, sql`${table.createdAt} DESC`),
  check('media_focal_check', sql`${table.focalX} BETWEEN 0 AND 1 AND ${table.focalY} BETWEEN 0 AND 1`),
])

export const mediaLocalizations = sqliteTable('media_localizations', {
  mediaId: text().notNull().references(() => media.id, { onDelete: 'cascade' }),
  locale: text({ enum: LOCALES }).notNull(),
  alt: text().notNull().default(''),
  caption: text(),
  credit: text(),
  translationState: text({ enum: TRANSLATION_STATES }).notNull(),
  updatedAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now).$onUpdateFn(now),
}, table => [primaryKey({ columns: [table.mediaId, table.locale] })])

export const mediaTracks = sqliteTable('media_tracks', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  mediaId: text().notNull().references(() => media.id, { onDelete: 'cascade' }),
  locale: text({ enum: LOCALES }).notNull(),
  kind: text({ enum: MEDIA_TRACK_KINDS }).notNull(),
  key: text().notNull(),
  label: text().notNull(),
  size: integer().notNull(),
}, table => [uniqueIndex('media_tracks_media_locale_kind_unique').on(table.mediaId, table.locale, table.kind)])

// Rebuilt on every save and publish of the entity that uses the media; blocks deleting media in use
export const mediaUsages = sqliteTable('media_usages', {
  mediaId: text().notNull().references(() => media.id, { onDelete: 'cascade' }),
  entityType: text().notNull(),
  entityId: text().notNull(),
  // Null when the use is not tied to one locale (a cover shared by all translations)
  locale: text({ enum: LOCALES }),
  context: text({ enum: MEDIA_USAGE_CONTEXTS }).notNull(),
}, table => [
  // No unique key: the rows of an entity are replaced as a whole on each save, and a NULL locale would not be unique
  index('media_usages_media_idx').on(table.mediaId),
  index('media_usages_entity_idx').on(table.entityType, table.entityId),
])
