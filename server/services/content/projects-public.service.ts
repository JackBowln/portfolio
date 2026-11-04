// The public projects (F07-T2): the list in the manual order, filtered by a technology, and a case study with its
// technologies, gallery, related projects and published alternates, each with the cache tags of ADR-0003 §2. null
// for anything not published in the locale, so the routes answer 404
import { cacheTags } from '../../../shared/cache/tags.ts'
import type { DocumentJson } from '../../../shared/content/document-schema.ts'
import { CURRENT_SCHEMA_VERSION } from '../../../shared/content/document-schema.ts'
import { PROJECTS_MAX, RELATED_PROJECTS } from '../../../shared/content/projects-public.ts'
import type { ProjectCard, ProjectList, ProjectTechnology, PublicProject } from '../../../shared/content/projects-public.ts'
import type { PublicMediaMap } from '../../../shared/media/public.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { resolveDocumentMedia, resolveMedia, resolveShareImage } from './document-media.ts'
import { listPublishedAlternates } from './localized.repo.ts'
import type { ProjectListRow, TechnologyRow } from './projects-public.repo.ts'
import { findPublishedProject, findTechnology, listPublishedProjects, relatedProjects, technologiesOf, technologiesWithProjects } from './projects-public.repo.ts'

const technology = ({ name, slug }: TechnologyRow): ProjectTechnology => ({ name, slug })

async function cards(db: Db, locale: Locale, rows: ProjectListRow[]): Promise<{ cards: ProjectCard[], mediaIds: string[] }> {
  const mediaIds = rows.flatMap(row => (row.coverMediaId ? [row.coverMediaId] : []))
  const [media, techs] = await Promise.all([resolveMedia(db, mediaIds, locale), technologiesOf(db, locale, rows.map(row => row.projectId))])
  return {
    mediaIds,
    cards: rows.map((row) => {
      const cover = row.coverMediaId ? media[row.coverMediaId] : undefined
      return {
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        cover: cover?.kind === 'image' ? cover.image : null,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        featured: row.featured,
        technologies: techs.filter(item => item.projectId === row.projectId).map(technology),
      }
    }),
  }
}

/** The list, or null for a technology that does not exist or has no published project in the locale */
export async function projectList(db: Db, locale: Locale, technologySlug?: string): Promise<ProjectList | null> {
  const filter = technologySlug ? await findTechnology(db, locale, technologySlug) : undefined
  if (technologySlug && !filter) {
    return null
  }
  const [rows, technologies] = await Promise.all([
    listPublishedProjects(db, locale, { limit: PROJECTS_MAX, tagId: filter?.id }),
    technologiesWithProjects(db, locale),
  ])
  if (filter && rows.length === 0) {
    return null
  }
  const { cards: items, mediaIds } = await cards(db, locale, rows)
  return {
    items,
    technologies: technologies.map(({ name, slug, count }) => ({ name, slug, count })),
    technology: filter ? technology(filter) : null,
    cacheTags: [cacheTags.projectList(locale), ...(filter ? [cacheTags.tag(filter.id)] : []), ...mediaIds.map(cacheTags.media)],
  }
}

/** The gallery as a document the renderer shows: one image, or a grid gallery */
function galleryDocument(ids: readonly string[]): DocumentJson | null {
  if (ids.length === 0) {
    return null
  }
  const block = ids.length === 1
    ? { type: 'image' as const, attrs: { id: 'project-gallery', mediaId: ids[0]!, caption: null, altOverride: null } }
    : { type: 'gallery' as const, attrs: { id: 'project-gallery', items: [...ids], layout: 'grid' as const } }
  return { type: 'doc', attrs: { schemaVersion: CURRENT_SCHEMA_VERSION }, content: [block] }
}

/** `mediaBaseUrl` makes the share image's URL absolute (the route passes the site's) */
export async function publicProject(db: Db, locale: Locale, slug: string, mediaBaseUrl = ''): Promise<PublicProject | null> {
  const project = await findPublishedProject(db, locale, slug)
  if (!project) {
    return null
  }
  const { localization, entity } = project.snapshot
  const gallery = galleryDocument(entity.galleryMediaIds)
  const [bodyMedia, galleryMedia, techs, related, alternates, share] = await Promise.all([
    resolveDocumentMedia(db, localization.body, locale, entity.coverMediaId ? [entity.coverMediaId] : []),
    gallery ? resolveDocumentMedia(db, gallery, locale) : Promise.resolve({} as PublicMediaMap),
    technologiesOf(db, locale, [project.projectId]),
    relatedProjects(db, locale, project.projectId, RELATED_PROJECTS),
    listPublishedAlternates(db, 'project', project.projectId),
    resolveShareImage(db, localization.ogImageMediaId, locale, mediaBaseUrl, localization.title),
  ])
  const relatedCards = await cards(db, locale, related)
  const media = { ...bodyMedia, ...galleryMedia }
  const cover = entity.coverMediaId ? media[entity.coverMediaId] : undefined
  return {
    locale,
    title: localization.title,
    summary: localization.summary,
    role: localization.role,
    periodStart: entity.periodStart,
    periodEnd: entity.periodEnd,
    repoUrl: entity.repoUrl,
    demoUrl: entity.demoUrl,
    highlights: localization.highlights,
    body: localization.body,
    gallery,
    media,
    cover: cover?.kind === 'image' ? cover.image : null,
    technologies: techs.map(technology),
    related: relatedCards.cards,
    alternates,
    seo: { title: localization.seoTitle ?? localization.title, description: localization.seoDescription ?? localization.summary, noindex: localization.noindex, image: share?.image ?? null },
    cacheTags: [
      cacheTags.project(project.projectId),
      cacheTags.projectLocale(project.projectId, locale),
      // Related projects change when another project is published
      cacheTags.projectList(locale),
      ...techs.map(item => cacheTags.tag(item.id)),
      ...Object.keys(media).map(cacheTags.media),
      ...relatedCards.mediaIds.map(cacheTags.media),
      ...(share ? [cacheTags.media(share.mediaId)] : []),
    ],
  }
}
