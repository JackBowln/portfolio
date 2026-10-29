// Articles, projects and pages (data-model §4, ADR-0006 §6): the entity holds what does not depend on the locale,
// the localization is the working copy plus the published snapshot copied out for one-query reads, and revisions
// are immutable gzip snapshots. The three types share the column groups below so one repository serves them all
import { sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { z } from 'zod'
import { documentJson, idList, pageBlocksJson, projectHighlights, segmentsMeta, snapshotSchemas, tocEntries } from '../../../shared/content/snapshot.ts'
import { LOCALES, PAGE_KEYS, PUBLICATION_STATUSES, REVISION_KINDS, TRANSLATION_STATES } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { now } from '../../../shared/utils/time.ts'
import { bytes, zodJson } from '../columns.ts'
import { users } from './auth.ts'
import { media } from './media.ts'
import { tags } from './taxonomy.ts'

const id = () => text().primaryKey().$defaultFn(() => uuidv7())
const userRef = () => text().references(() => users.id, { onDelete: 'set null' })
const mediaRef = () => text().references(() => media.id, { onDelete: 'set null' })
const createdAt = () => integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now)
const updatedAt = () => integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now).$onUpdateFn(now)
const timestamp = () => integer({ mode: 'timestamp_ms' })

const entityAudit = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: userRef(),
  updatedBy: userRef(),
  deletedAt: timestamp(),
})

/** Columns every localization has: SEO, publication, translation and concurrency */
function localizationColumns<S extends z.ZodType>(revisionId: () => AnySQLiteColumn, snapshot: S) {
  return {
    id: id(),
    locale: text({ enum: LOCALES }).notNull(),
    seoTitle: text(),
    seoDescription: text(),
    ogImageMediaId: mediaRef(),
    noindex: integer({ mode: 'boolean' }).notNull().default(false),
    status: text({ enum: PUBLICATION_STATUSES }).notNull().default('draft'),
    scheduledAt: timestamp(),
    // Published revisions are never pruned, so the pointer cannot dangle
    publishedRevisionId: text().references(revisionId),
    // Uncompressed copy of the published revision: the public page reads only this and the published_* columns
    publishedSnapshot: zodJson(snapshot)(),
    publishedAt: timestamp(),
    translationState: text({ enum: TRANSLATION_STATES }).notNull(),
    // The pt-BR revision a translation started from
    sourceRevisionId: text().references(revisionId),
    segmentsMeta: zodJson(segmentsMeta)().notNull().$defaultFn(() => ({})),
    reviewedBy: userRef(),
    reviewedAt: timestamp(),
    // Optimistic concurrency: +1 on every write
    version: integer().notNull().default(1),
    // SHA-256 of the canonical working snapshot; differs from the published revision's hash when there are changes
    workingHash: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    updatedBy: userRef(),
    deletedAt: timestamp(),
  }
}

/** Title, slug and the document body of articles and projects, with what the server derives from them */
const sluggedColumns = () => ({
  title: text().notNull(),
  slug: text().notNull(),
  body: zodJson(documentJson)().notNull(),
  wordCount: integer().notNull().default(0),
  readingTimeMin: integer().notNull().default(0),
  toc: zodJson(tocEntries)().notNull().$defaultFn(() => []),
  publishedSlug: text(),
  publishedTitle: text(),
  publishedCoverMediaId: mediaRef(),
  publishedReadingTimeMin: integer(),
})

interface LocalizationTable {
  locale: AnySQLiteColumn
  status: AnySQLiteColumn
  scheduledAt: AnySQLiteColumn
  translationState: AnySQLiteColumn
  publishedRevisionId: AnySQLiteColumn
  publishedSnapshot: AnySQLiteColumn
  publishedAt: AnySQLiteColumn
  id: AnySQLiteColumn
}

function localizationConstraints(name: string, table: LocalizationTable) {
  return [
    check(`${name}_scheduled_check`, sql`${table.status} <> 'scheduled' OR ${table.scheduledAt} IS NOT NULL`),
    // SOURCE_LOCALE is the source, and only it is (a literal: CHECK constraints take no parameters)
    check(`${name}_source_check`, sql`(${table.locale} = 'pt-BR') = (${table.translationState} = 'source')`),
    check(`${name}_published_check`, sql`(${table.publishedRevisionId} IS NULL) = (${table.publishedSnapshot} IS NULL)`),
    index(`${name}_published_idx`).on(table.locale, sql`${table.publishedAt} DESC`, sql`${table.id} DESC`).where(sql`${table.publishedRevisionId} IS NOT NULL`),
    index(`${name}_status_scheduled_idx`).on(table.status, table.scheduledAt),
  ]
}

function sluggedConstraints(name: string, table: LocalizationTable & { slug: AnySQLiteColumn, publishedSlug: AnySQLiteColumn, deletedAt: AnySQLiteColumn }) {
  return [
    uniqueIndex(`${name}_locale_slug_unique`).on(table.locale, table.slug).where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex(`${name}_locale_published_slug_unique`).on(table.locale, table.publishedSlug).where(sql`${table.publishedSlug} IS NOT NULL`),
    check(`${name}_published_slug_check`, sql`(${table.publishedRevisionId} IS NULL) = (${table.publishedSlug} IS NULL)`),
  ]
}

/** Immutable history; only the cron prunes old autosaves (data-model §4.3) */
function revisionColumns(localizationId: () => AnySQLiteColumn) {
  return {
    id: id(),
    localizationId: text().notNull().references(localizationId),
    locale: text({ enum: LOCALES }).notNull(),
    // 1, 2, 3… per localization
    number: integer().notNull(),
    kind: text({ enum: REVISION_KINDS }).notNull(),
    snapshotGz: bytes().notNull(),
    contentHash: text().notNull(),
    note: text(),
    createdBy: userRef(),
    createdAt: createdAt(),
  }
}

function revisionConstraints(name: string, table: { localizationId: AnySQLiteColumn, number: AnySQLiteColumn, createdAt: AnySQLiteColumn }) {
  return [
    uniqueIndex(`${name}_localization_number_unique`).on(table.localizationId, table.number),
    index(`${name}_localization_created_idx`).on(table.localizationId, sql`${table.createdAt} DESC`),
  ]
}

// Articles (§4.1–4.4)

export const articles = sqliteTable('articles', {
  id: id(),
  authorId: text().notNull().references(() => users.id),
  featured: integer({ mode: 'boolean' }).notNull().default(false),
  // Working copy; public only once a localization is published
  coverMediaId: mediaRef(),
  draftTagIds: zodJson(idList)().notNull().$defaultFn(() => []),
  firstPublishedAt: timestamp(),
  ...entityAudit(),
})

export const articleLocalizations = sqliteTable('article_localizations', {
  ...localizationColumns((): AnySQLiteColumn => articleRevisions.id, snapshotSchemas.article),
  articleId: text().notNull().references(() => articles.id),
  ...sluggedColumns(),
  excerpt: text().notNull().default(''),
  publishedExcerpt: text(),
}, table => [
  uniqueIndex('article_localizations_article_locale_unique').on(table.articleId, table.locale),
  ...localizationConstraints('article_localizations', table),
  ...sluggedConstraints('article_localizations', table),
])

export const articleRevisions = sqliteTable('article_revisions', {
  ...revisionColumns((): AnySQLiteColumn => articleLocalizations.id),
  articleId: text().notNull().references(() => articles.id),
}, table => revisionConstraints('article_revisions', table))

// The published tags, rebuilt from draft_tag_ids when the pt-BR localization is published
export const articleTags = sqliteTable('article_tags', {
  articleId: text().notNull().references(() => articles.id, { onDelete: 'cascade' }),
  tagId: text().notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, table => [primaryKey({ columns: [table.articleId, table.tagId] })])

// Projects (§4.5)

const yearMonth = (column: AnySQLiteColumn) => sql`${column} IS NULL OR ${column} GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'`
const httpsUrl = (column: AnySQLiteColumn) => sql`${column} IS NULL OR ${column} LIKE 'https://%'`

export const projects = sqliteTable('projects', {
  id: id(),
  sortOrder: integer().notNull().default(0),
  featured: integer({ mode: 'boolean' }).notNull().default(false),
  coverMediaId: mediaRef(),
  galleryMediaIds: zodJson(idList)().notNull().$defaultFn(() => []),
  draftTechnologyIds: zodJson(idList)().notNull().$defaultFn(() => []),
  // YYYY-MM
  periodStart: text(),
  periodEnd: text(),
  repoUrl: text(),
  demoUrl: text(),
  ...entityAudit(),
}, table => [
  check('projects_period_start_check', yearMonth(table.periodStart)),
  check('projects_period_end_check', yearMonth(table.periodEnd)),
  check('projects_repo_url_check', httpsUrl(table.repoUrl)),
  check('projects_demo_url_check', httpsUrl(table.demoUrl)),
  index('projects_sort_order_idx').on(table.sortOrder),
])

export const projectLocalizations = sqliteTable('project_localizations', {
  ...localizationColumns((): AnySQLiteColumn => projectRevisions.id, snapshotSchemas.project),
  projectId: text().notNull().references(() => projects.id),
  ...sluggedColumns(),
  summary: text().notNull().default(''),
  role: text().notNull().default(''),
  // Verifiable results only; never invented metrics
  highlights: zodJson(projectHighlights)().notNull().$defaultFn(() => []),
  publishedSummary: text(),
}, table => [
  uniqueIndex('project_localizations_project_locale_unique').on(table.projectId, table.locale),
  ...localizationConstraints('project_localizations', table),
  ...sluggedConstraints('project_localizations', table),
])

export const projectRevisions = sqliteTable('project_revisions', {
  ...revisionColumns((): AnySQLiteColumn => projectLocalizations.id),
  projectId: text().notNull().references(() => projects.id),
}, table => revisionConstraints('project_revisions', table))

// The published technologies, in display order
export const projectTechnologies = sqliteTable('project_technologies', {
  projectId: text().notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tagId: text().notNull().references(() => tags.id, { onDelete: 'cascade' }),
  position: integer().notNull(),
}, table => [primaryKey({ columns: [table.projectId, table.tagId] })])

// Pages (§4.6): no slug, the path comes from the i18n routes

export const pages = sqliteTable('pages', {
  id: id(),
  key: text({ enum: PAGE_KEYS }).notNull().unique('pages_key_unique'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const pageLocalizations = sqliteTable('page_localizations', {
  ...localizationColumns((): AnySQLiteColumn => pageRevisions.id, snapshotSchemas.page),
  pageId: text().notNull().references(() => pages.id),
  blocks: zodJson(pageBlocksJson)().notNull().$defaultFn(() => ({})),
}, table => [
  uniqueIndex('page_localizations_page_locale_unique').on(table.pageId, table.locale),
  ...localizationConstraints('page_localizations', table),
])

export const pageRevisions = sqliteTable('page_revisions', {
  ...revisionColumns((): AnySQLiteColumn => pageLocalizations.id),
  pageId: text().notNull().references(() => pages.id),
}, table => revisionConstraints('page_revisions', table))
