// Projects in the admin (F07-T1, data-model §4.5, RF-09.1–09.2): create, read, save the pt-BR working copy, history,
// restore, manual order, publish and unpublish, and soft delete. Saves, versions and restores go through the same
// core as articles (working-copy.ts) and publishing through the same guarded batch (publishing.service.ts, a
// PublishModel); what is a project's own is here: its entity fields (cover, gallery, technologies, period, links,
// featured), the case-study template and the checks on them. Highlights are verifiable results only: the server
// checks their shape, the admin says so
import { projectPurgeTags } from '../../../shared/cache/purge.ts'
import { contentHash } from '../../../shared/content/canonical-json.ts'
import { projectPath } from '../../../shared/content/paths.ts'
import type { ProjectUpdate } from '../../../shared/content/project-input.ts'
import { projectTemplate } from '../../../shared/content/project-input.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import type { SnapshotEntity } from '../../../shared/content/snapshot.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { projectTechnologies } from '../../db/schema/content.ts'
import { eq } from 'drizzle-orm'
import { createAppError, isUniqueViolation } from '../../utils/errors.ts'
import type { ProjectLocalizationRow, ProjectRow } from './projects.repo.ts'
import { findProject, insertProjectStatements, listProjectRows, nextSortOrder, orderStatements } from './projects.repo.ts'
import type { Actor, PublishModel, PublishResult } from './publishing.service.ts'
import { documentImages, publishContent, unpublishContent } from './publishing.service.ts'
import { projectRelations } from './publishing.repo.ts'
import { existingTagIds } from './tags.repo.ts'
import type { RevisionListItem } from './working-copy.ts'
import {
  assertMedia,
  assertSavable,
  freeSlug,
  getSourceRevision,
  listSourceRevisions,
  restorableRevision,
  saveSourceVersion,
  slugConflict,
  sourceCopyOf,
  writeWorkingCopy,
} from './working-copy.ts'
import { findLocalizations, softDeleteStatements } from './working-copy.repo.ts'

/** When a title has no letter or digit left for a slug */
const FALLBACK_SLUG = 'projeto'

export interface ProjectDetail {
  id: string
  /** Who created it: the author for ownership checks */
  authorId: string | null
  authorName: string | null
  featured: boolean
  sortOrder: number
  coverMediaId: string | null
  galleryMediaIds: string[]
  technologyIds: string[]
  periodStart: string | null
  periodEnd: string | null
  repoUrl: string | null
  demoUrl: string | null
  createdAt: Date
  updatedAt: Date
  localizations: ProjectLocalizationRow[]
}

const detailOf = (project: ProjectRow & { authorName: string | null }, localizations: ProjectLocalizationRow[]): ProjectDetail => ({
  id: project.id,
  authorId: project.createdBy,
  authorName: project.authorName,
  featured: project.featured,
  sortOrder: project.sortOrder,
  coverMediaId: project.coverMediaId,
  galleryMediaIds: project.galleryMediaIds,
  technologyIds: project.draftTechnologyIds,
  periodStart: project.periodStart,
  periodEnd: project.periodEnd,
  repoUrl: project.repoUrl,
  demoUrl: project.demoUrl,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  localizations,
})

type ProjectEntity = SnapshotEntity<'project'>

/** The entity fields of a project's snapshot */
export const projectEntity = (project: Pick<ProjectDetail, keyof ProjectEntity>): ProjectEntity => ({
  coverMediaId: project.coverMediaId,
  galleryMediaIds: project.galleryMediaIds,
  technologyIds: project.technologyIds,
  periodStart: project.periodStart,
  periodEnd: project.periodEnd,
  repoUrl: project.repoUrl,
  demoUrl: project.demoUrl,
})

const entityColumns = (entity: ProjectEntity, featured?: boolean) => ({
  coverMediaId: entity.coverMediaId,
  galleryMediaIds: entity.galleryMediaIds,
  draftTechnologyIds: entity.technologyIds,
  periodStart: entity.periodStart,
  periodEnd: entity.periodEnd,
  repoUrl: entity.repoUrl,
  demoUrl: entity.demoUrl,
  ...(featured === undefined ? {} : { featured }),
})

const galleryUses = (entity: ProjectEntity) => entity.galleryMediaIds.map(mediaId => ({ mediaId, locale: null, context: 'gallery' as const }))

/** The project and its working copies; 404 for a missing or deleted one */
export async function getProject(db: Db, id: string): Promise<ProjectDetail> {
  const project = await findProject(db, id)
  if (!project) {
    throw createAppError('not_found')
  }
  return detailOf(project, await findLocalizations(db, 'project', [id]))
}

/** Every project in the manual order, with each localization's state */
export async function listProjects(db: Db) {
  const rows = await listProjectRows(db)
  const localizations = await findLocalizations(db, 'project', rows.map(row => row.project.id))
  return {
    items: rows.map(({ project, authorName }) => ({
      id: project.id,
      authorId: project.createdBy,
      authorName,
      featured: project.featured,
      sortOrder: project.sortOrder,
      updatedAt: project.updatedAt,
      localizations: localizations.filter(item => item.projectId === project.id).map(item => ({
        locale: item.locale,
        title: item.title,
        slug: item.slug,
        status: item.status,
        translationState: item.translationState,
        updatedAt: item.updatedAt,
      })),
    })),
  }
}

/**
 * A new draft at the end of the order, with its pt-BR working copy: the case-study sections as the body (Contexto,
 * Desafio, Solução, Resultados) and the slug from the title, with -2, -3… when it is taken
 */
export async function createProject(db: Db, userId: string, title: string): Promise<ProjectDetail> {
  const slug = await freeSlug(db, 'project', title, FALLBACK_SLUG)
  const id = uuidv7()
  const localization = {
    id: uuidv7(),
    projectId: id,
    locale: SOURCE_LOCALE,
    title,
    slug,
    body: projectTemplate(),
    translationState: 'source' as const,
    updatedBy: userId,
  }
  const entity: ProjectEntity = { coverMediaId: null, galleryMediaIds: [], technologyIds: [], periodStart: null, periodEnd: null, repoUrl: null, demoUrl: null }
  const workingHash = await contentHash(snapshotOf('project', entity, localization))
  try {
    await db.batch(insertProjectStatements(db, { id, sortOrder: await nextSortOrder(db), createdBy: userId, updatedBy: userId }, { ...localization, workingHash }))
  }
  catch (error) {
    // Someone took the slug between the check and the insert
    throw isUniqueViolation(error) ? slugConflict() : error
  }
  return getProject(db, id)
}

async function assertTechnologies(db: Db, ids: readonly string[] | undefined): Promise<void> {
  if (!ids || ids.length === 0) {
    return
  }
  const found = await existingTagIds(db, ids, 'technology')
  const missing = ids.filter(id => !found.has(id))
  if (missing.length > 0) {
    throw createAppError('bad_request', 'Invalid input', missing.map(id => ({ path: 'technologyIds', message: `technology ${id} does not exist` })))
  }
}

/** The period, once merged with what is saved: the end never comes before the start */
function assertPeriod(entity: ProjectEntity): void {
  if (entity.periodStart && entity.periodEnd && entity.periodEnd < entity.periodStart) {
    throw createAppError('bad_request', 'Invalid input', [{ path: 'periodEnd', message: 'must not be before the start' }])
  }
}

/**
 * Saves the pt-BR working copy and the entity fields. 409 with path "version" when the copy changed since the
 * editor read it, and with path "slug" when another project of the locale has the slug
 */
export async function updateProject(db: Db, userId: string, project: ProjectDetail, input: ProjectUpdate): Promise<ProjectDetail> {
  const current = sourceCopyOf(project.localizations)
  await assertSavable(db, 'project', current, input)
  await assertTechnologies(db, input.technologyIds)

  const { version, featured, coverMediaId, galleryMediaIds, technologyIds, periodStart, periodEnd, repoUrl, demoUrl, ...localized } = input
  const fields = Object.fromEntries(Object.entries(localized).filter(([, value]) => value !== undefined)) as Partial<ProjectLocalizationRow>
  const saved = projectEntity(project)
  const changes = { coverMediaId, galleryMediaIds, technologyIds, periodStart, periodEnd, repoUrl, demoUrl }
  const entity = { ...saved, ...Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) } as ProjectEntity
  assertPeriod(entity)
  await assertMedia(db, {
    images: { coverMediaId: input.coverMediaId, ogImageMediaId: input.ogImageMediaId },
    gallery: input.galleryMediaIds,
    body: input.body ? { ...current, ...fields }.body : undefined,
  })
  await writeWorkingCopy(db, 'project', userId, project.id, current, { version, fields, entity, entityColumns: entityColumns(entity, featured), extraUses: galleryUses(entity), kind: 'autosave' })
  return getProject(db, project.id)
}

/** The pt-BR history, newest first, without snapshots */
export function listProjectRevisions(db: Db, project: ProjectDetail): Promise<RevisionListItem[]> {
  return listSourceRevisions(db, 'project', sourceCopyOf(project.localizations).id)
}

/** One pt-BR revision with its snapshot; 404 for a revision of another project or locale */
export function getProjectRevision(db: Db, project: ProjectDetail, revisionId: string) {
  return getSourceRevision(db, 'project', sourceCopyOf(project.localizations).id, revisionId)
}

/** A named version of the working copy (F06-T2, decision 3) */
export function saveProjectVersion(db: Db, userId: string, project: ProjectDetail, input: { version: number, note: string | null }): Promise<{ revision: RevisionListItem, created: boolean }> {
  return saveSourceVersion(db, 'project', {
    userId,
    entityId: project.id,
    current: sourceCopyOf(project.localizations),
    entity: projectEntity(project),
    version: input.version,
    note: input.note,
    reload: async () => sourceCopyOf((await getProject(db, project.id)).localizations),
  })
}

/**
 * Copies a pt-BR revision back into the working copy (texts, highlights, body, SEO and the entity fields) and records
 * a `restore` revision; nothing is deleted. Technologies deleted since are left out
 */
export async function restoreProjectRevision(db: Db, userId: string, project: ProjectDetail, input: { version: number, revisionId: string }): Promise<{ project: ProjectDetail, restored: number }> {
  const current = sourceCopyOf(project.localizations)
  const revision = await restorableRevision(db, 'project', current, input)
  const { localization, entity } = revision.snapshot
  const technologies = await existingTagIds(db, entity.technologyIds, 'technology')
  const restored = { ...entity, technologyIds: entity.technologyIds.filter(id => technologies.has(id)) }
  await writeWorkingCopy(db, 'project', userId, project.id, current, {
    version: input.version,
    fields: localization,
    entity: restored,
    entityColumns: entityColumns(restored),
    extraUses: galleryUses(restored),
    kind: 'restore',
  })
  return { project: await getProject(db, project.id), restored: revision.number }
}

/**
 * The manual order of the whole list (RF-09.2): `ids` must be every live project, once. 409 on "ids" when the list
 * changed since the admin read it (a project created or deleted meanwhile)
 */
export async function reorderProjects(db: Db, userId: string, ids: readonly string[]): Promise<void> {
  const live = (await listProjectRows(db)).map(row => row.project.id)
  if (live.length !== ids.length || !live.every(id => ids.includes(id))) {
    throw createAppError('conflict', 'The project list changed since it was opened', [{ path: 'ids', message: 'stale' }])
  }
  const [first, ...rest] = orderStatements(db, ids, userId)
  await db.batch([first!, ...rest])
}

/** Soft delete; the slug is free again. A published project is unpublished first */
export async function deleteProject(db: Db, userId: string, project: ProjectDetail): Promise<void> {
  if (project.localizations.some(item => item.publishedRevisionId !== null)) {
    throw createAppError('conflict', 'Unpublish the project first', [{ path: 'status', message: 'published' }])
  }
  await db.batch(softDeleteStatements(db, 'project', project.id, userId))
}

export const PROJECT_PUBLISHING: PublishModel<'project', ProjectDetail> = {
  type: 'project',
  actions: { published: 'project.published', unpublished: 'project.unpublished' },
  entity: projectEntity,
  // Cover, body images and galleries, and the project's own gallery
  informativeImages: (project, body) => [...new Set([...documentImages(project.coverMediaId, body), ...project.galleryMediaIds])],
  published: snapshot => ({ publishedSummary: snapshot.localization.summary }),
  unpublished: { publishedSummary: null },
  relations: (db, project, isSource) => projectRelations(db, project.id, isSource ? project.technologyIds : null),
  dropRelations: (db, project) => [db.delete(projectTechnologies).where(eq(projectTechnologies.projectId, project.id))],
  path: projectPath,
  purge: projectPurgeTags,
  relationIds: entity => entity.technologyIds,
  reload: getProject,
}

/** Publishes a project localization now (RF-05.4) */
export function publishProject(db: Db, actor: Actor, project: ProjectDetail, locale: Locale, version: number): Promise<PublishResult<ProjectDetail>> {
  return publishContent(db, PROJECT_PUBLISHING, actor, project, locale, version)
}

/** Takes a project localization off the site; for pt-BR, its published translations too */
export function unpublishProject(db: Db, actor: Actor, project: ProjectDetail, locale: Locale): Promise<PublishResult<ProjectDetail>> {
  return unpublishContent(db, PROJECT_PUBLISHING, actor, project, locale)
}
