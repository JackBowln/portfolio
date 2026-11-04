// Public project reads (F07-T2, data-model §10): only the published_* columns, published_snapshot and
// project_technologies (what was published), never the working copy (invariant §9.3), and only live projects.
// Lists follow the manual order (sort_order). Technology names are pt-BR until tag names are translated (F09):
// they are proper nouns, so every locale shows them (decision 1)
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Snapshot } from '../../../shared/content/snapshot.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { projectLocalizations, projects, projectTechnologies } from '../../db/schema/content.ts'
import { tagLocalizations, tags } from '../../db/schema/taxonomy.ts'
import { publishedIndexable } from './localized.repo.ts'

const live = (locale: Locale): SQL => and(
  eq(projectLocalizations.locale, locale),
  isNotNull(projectLocalizations.publishedRevisionId),
  isNull(projectLocalizations.deletedAt),
  isNull(projects.deletedAt),
)!

const snapshotField = (path: string) => sql<string | null>`json_extract(${projectLocalizations.publishedSnapshot}, ${path})`

export interface ProjectListRow {
  projectId: string
  slug: string
  title: string
  summary: string
  coverMediaId: string | null
  periodStart: string | null
  periodEnd: string | null
  featured: boolean
}

const listColumns = {
  projectId: projects.id,
  slug: sql<string>`${projectLocalizations.publishedSlug}`,
  title: sql<string>`${projectLocalizations.publishedTitle}`,
  summary: sql<string>`coalesce(${projectLocalizations.publishedSummary}, '')`,
  coverMediaId: projectLocalizations.publishedCoverMediaId,
  periodStart: snapshotField('$.entity.periodStart'),
  periodEnd: snapshotField('$.entity.periodEnd'),
  featured: projects.featured,
}

const withTechnology = (tagId: string) => sql`EXISTS (SELECT 1 FROM ${projectTechnologies} WHERE ${projectTechnologies.projectId} = ${projects.id} AND ${projectTechnologies.tagId} = ${tagId})`

/** The locale's published projects in the manual order; `tagId` narrows to a technology */
export async function listPublishedProjects(db: Db, locale: Locale, { limit, tagId, exceptId }: { limit: number, tagId?: string | undefined, exceptId?: string | undefined }): Promise<ProjectListRow[]> {
  return db.select(listColumns).from(projectLocalizations)
    .innerJoin(projects, eq(projects.id, projectLocalizations.projectId))
    .where(and(live(locale), tagId ? withTechnology(tagId) : undefined, exceptId ? ne(projects.id, exceptId) : undefined))
    .orderBy(asc(projects.sortOrder), sql`${projects.id} DESC`)
    .limit(limit)
}

export interface PublishedProject {
  projectId: string
  featured: boolean
  snapshot: Snapshot<'project'>
}

/** The project published at (locale, slug): one query on the published-slug index */
export async function findPublishedProject(db: Db, locale: Locale, slug: string): Promise<PublishedProject | undefined> {
  const [row] = await db.select({ projectId: projects.id, featured: projects.featured, snapshot: projectLocalizations.publishedSnapshot })
    .from(projectLocalizations)
    .innerJoin(projects, eq(projects.id, projectLocalizations.projectId))
    .where(and(live(locale), eq(projectLocalizations.publishedSlug, slug)))
  return row ? { ...row, snapshot: row.snapshot! } : undefined
}

export interface TechnologyRow {
  id: string
  name: string
  slug: string
}

const technologyName = (locale: Locale) => sql<string>`coalesce(
  (SELECT n.name FROM ${tagLocalizations} n WHERE n.tag_id = ${tags.id} AND n.locale = ${locale}),
  ${tagLocalizations.name}
)`

/** The published technologies of these projects, in each project's order */
export async function technologiesOf(db: Db, locale: Locale, projectIds: readonly string[]): Promise<(TechnologyRow & { projectId: string })[]> {
  if (projectIds.length === 0) {
    return []
  }
  return db.select({ projectId: projectTechnologies.projectId, id: tags.id, name: technologyName(locale), slug: tagLocalizations.slug })
    .from(projectTechnologies)
    .innerJoin(tags, eq(tags.id, projectTechnologies.tagId))
    .innerJoin(tagLocalizations, and(eq(tagLocalizations.tagId, tags.id), eq(tagLocalizations.locale, SOURCE_LOCALE)))
    .where(inArray(projectTechnologies.projectId, [...projectIds]))
    .orderBy(asc(projectTechnologies.position))
}

/** A technology by its (pt-BR) slug */
export async function findTechnology(db: Db, locale: Locale, slug: string): Promise<TechnologyRow | undefined> {
  const [row] = await db.select({ id: tags.id, name: technologyName(locale), slug: tagLocalizations.slug }).from(tags)
    .innerJoin(tagLocalizations, and(eq(tagLocalizations.tagId, tags.id), eq(tagLocalizations.locale, SOURCE_LOCALE)))
    .where(and(eq(tags.kind, 'technology'), eq(tagLocalizations.slug, slug)))
  return row
}

/** Technologies of the locale's published projects, with the count, by name */
export async function technologiesWithProjects(db: Db, locale: Locale): Promise<(TechnologyRow & { count: number })[]> {
  return db.select({ id: tags.id, name: technologyName(locale), slug: tagLocalizations.slug, count: sql<number>`count(DISTINCT ${projects.id})`.mapWith(Number) })
    .from(projectTechnologies)
    .innerJoin(tags, eq(tags.id, projectTechnologies.tagId))
    .innerJoin(tagLocalizations, and(eq(tagLocalizations.tagId, tags.id), eq(tagLocalizations.locale, SOURCE_LOCALE)))
    .innerJoin(projects, eq(projects.id, projectTechnologies.projectId))
    .innerJoin(projectLocalizations, eq(projectLocalizations.projectId, projects.id))
    .where(live(locale))
    .groupBy(tags.id, tagLocalizations.name, tagLocalizations.slug)
    .orderBy(asc(tagLocalizations.name))
}

/** Projects that share a published technology with this one, in the manual order */
export async function relatedProjects(db: Db, locale: Locale, projectId: string, limit: number): Promise<ProjectListRow[]> {
  const shared = sql`EXISTS (SELECT 1 FROM ${projectTechnologies} mine JOIN ${projectTechnologies} theirs ON theirs.tag_id = mine.tag_id
    WHERE mine.project_id = ${projectId} AND theirs.project_id = ${projects.id})`
  return db.select(listColumns).from(projectLocalizations)
    .innerJoin(projects, eq(projects.id, projectLocalizations.projectId))
    .where(and(live(locale), ne(projects.id, projectId), shared))
    .orderBy(asc(projects.sortOrder), sql`${projects.id} DESC`)
    .limit(limit)
}

/** Every published project localization, for the sitemap: one row per (project, locale) */
export async function allPublishedProjects(db: Db): Promise<{ projectId: string, locale: Locale, slug: string, publishedAt: Date }[]> {
  return db.select({
    projectId: projects.id,
    locale: projectLocalizations.locale,
    slug: sql<string>`${projectLocalizations.publishedSlug}`,
    publishedAt: sql<number>`${projectLocalizations.publishedAt}`.mapWith(value => new Date(Number(value))),
  }).from(projectLocalizations)
    .innerJoin(projects, eq(projects.id, projectLocalizations.projectId))
    .where(and(isNotNull(projectLocalizations.publishedRevisionId), isNull(projectLocalizations.deletedAt), isNull(projects.deletedAt), publishedIndexable(projectLocalizations.publishedSnapshot)))
    .orderBy(projects.id, projectLocalizations.locale)
}
