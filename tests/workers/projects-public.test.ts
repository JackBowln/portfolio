// F07-T2: the public projects on a real D1. Only published snapshots are read (never the working copy), per locale,
// in the manual order; the technology filter (an unknown or empty one is null, so 404); a project only in pt-BR is
// absent elsewhere; the gallery becomes a document; related projects share a technology; the sitemap rows
import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { mediaLocalizations, users } from '../../server/db/schema'
import type { media } from '../../server/db/schema'
import { createLocalization } from '../../server/services/content/localized.repo'
import { allPublishedProjects } from '../../server/services/content/projects-public.repo'
import { projectList, publicProject } from '../../server/services/content/projects-public.service'
import { createProject, getProject, publishProject, reorderProjects, unpublishProject, updateProject, listProjects } from '../../server/services/content/projects.service'
import { createTag } from '../../server/services/content/tags.service'
import { insertMedia, markReady } from '../../server/services/media/media.repo'
import type { ProjectUpdate } from '../../shared/content/project-input'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Público', email: `projects-public-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const actor = { userId, ip: null, ipHashSalt: undefined }
const unique = () => uuidv7().slice(-8)
const sha = () => [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')
const technology = async (name = `Tec ${unique()}`) => createTag(db, userId, 'technology', { name })

async function image() {
  const hash = sha()
  const row: typeof media.$inferInsert = { id: uuidv7(), kind: 'image', mimeType: 'image/jpeg', originalFilename: 'f.jpg', sizeBytes: 1, width: 10, height: 10, sha256: hash, originalKey: `originals/${hash}.jpg`, variants: [] }
  await insertMedia(db, row, [])
  await markReady(db, row.id!)
  await db.insert(mediaLocalizations).values({ mediaId: row.id!, locale: 'pt-BR', alt: 'Imagem', translationState: 'source' })
  return row.id!
}

/** A pt-BR project, published with these fields */
async function published(title: string, fields: Omit<ProjectUpdate, 'version'> = {}) {
  const project = await createProject(db, userId, title)
  const saved = await updateProject(db, userId, project, { version: 1, summary: `Resumo de ${title}`, ...fields })
  await publishProject(db, actor, saved, 'pt-BR', 2)
  return getProject(db, project.id)
}

const slugOf = (project: Awaited<ReturnType<typeof getProject>>) => project.localizations[0]!.slug

describe('public projects', () => {
  it('reads the published snapshot, never the working copy', async () => {
    const tech = await technology()
    const project = await published(`Publicado ${unique()}`, { technologyIds: [tech.id], periodStart: '2023-02', periodEnd: '2023-09', repoUrl: 'https://github.com/x/y', highlights: [{ label: 'Medido', value: '10%' }] })
    await updateProject(db, userId, project, { version: 2, title: 'Rascunho secreto', summary: 'Não publicado', repoUrl: 'https://example.com/novo' })
    const read = await publicProject(db, 'pt-BR', slugOf(project))
    expect(read).toMatchObject({
      title: project.localizations[0]!.title,
      summary: `Resumo de ${project.localizations[0]!.title}`,
      periodStart: '2023-02',
      periodEnd: '2023-09',
      repoUrl: 'https://github.com/x/y',
      highlights: [{ label: 'Medido', value: '10%' }],
      technologies: [{ name: tech.name, slug: tech.slug }],
      alternates: [{ locale: 'pt-BR', slug: slugOf(project) }],
    })
    expect(read?.cacheTags).toEqual(expect.arrayContaining([`project:${project.id}`, `project:${project.id}:pt-BR`, 'list:projects:pt-BR', `tag:${tech.id}`]))
    const card = (await projectList(db, 'pt-BR'))?.items.find(item => item.slug === slugOf(project))
    expect(card).toMatchObject({ title: project.localizations[0]!.title, technologies: [{ name: tech.name, slug: tech.slug }] })
  })

  it('follows the manual order and filters by a technology; an unknown or empty one is null', async () => {
    const tech = await technology()
    const empty = await technology()
    const a = await published(`A ${unique()}`, { technologyIds: [tech.id] })
    const b = await published(`B ${unique()}`, { technologyIds: [tech.id] })
    const ids = (await listProjects(db)).items.map(item => item.id)
    // b before a
    await reorderProjects(db, userId, [b.id, a.id, ...ids.filter(id => id !== a.id && id !== b.id)])
    const filtered = await projectList(db, 'pt-BR', tech.slug)
    expect(filtered?.items.map(item => item.slug)).toEqual([slugOf(b), slugOf(a)])
    expect(filtered?.technology).toEqual({ name: tech.name, slug: tech.slug })
    expect(filtered?.cacheTags).toEqual(expect.arrayContaining(['list:projects:pt-BR', `tag:${tech.id}`]))
    expect((await projectList(db, 'pt-BR'))?.technologies.find(item => item.slug === tech.slug)?.count).toBe(2)
    expect(await projectList(db, 'pt-BR', 'nao-existe')).toBeNull()
    expect(await projectList(db, 'pt-BR', empty.slug)).toBeNull()
  })

  it('keeps a project published only in pt-BR out of other locales, and unpublished out of all', async () => {
    const project = await published(`Só português ${unique()}`)
    const slug = slugOf(project)
    expect(await publicProject(db, 'en', slug)).toBeNull()
    expect((await projectList(db, 'en'))?.items.some(item => item.slug === slug)).toBe(false)

    await createLocalization(db, 'project', { projectId: project.id, locale: 'de', title: 'Nur Deutsch', slug: `nur-deutsch-${unique()}`, body: { type: 'doc', content: [] }, translationState: 'approved' }, { coverMediaId: null, galleryMediaIds: [], technologyIds: [], periodStart: null, periodEnd: null, repoUrl: null, demoUrl: null })
    await publishProject(db, actor, await getProject(db, project.id), 'de', 1)
    const de = (await getProject(db, project.id)).localizations.find(item => item.locale === 'de')!
    expect((await publicProject(db, 'de', de.slug))?.alternates.map(item => item.locale)).toEqual(['de', 'pt-BR'])
    expect((await allPublishedProjects(db)).filter(row => row.projectId === project.id).map(row => row.locale)).toEqual(['de', 'pt-BR'])

    await unpublishProject(db, actor, await getProject(db, project.id), 'pt-BR')
    expect(await publicProject(db, 'pt-BR', slug)).toBeNull()
    expect(await publicProject(db, 'de', de.slug)).toBeNull()
  })

  it('renders the gallery as a document: one image, or a grid gallery', async () => {
    const [one, two] = [await image(), await image()]
    const single = await published(`Uma imagem ${unique()}`, { galleryMediaIds: [one] })
    const singleRead = await publicProject(db, 'pt-BR', slugOf(single))
    expect(singleRead?.gallery?.content).toEqual([{ type: 'image', attrs: { id: 'project-gallery', mediaId: one, caption: null, altOverride: null } }])
    expect(singleRead?.media[one]).toBeDefined()
    const grid = await published(`Duas imagens ${unique()}`, { galleryMediaIds: [one, two] })
    expect((await publicProject(db, 'pt-BR', slugOf(grid)))?.gallery?.content).toEqual([{ type: 'gallery', attrs: { id: 'project-gallery', items: [one, two], layout: 'grid' } }])
    expect((await publicProject(db, 'pt-BR', slugOf(await published(`Sem galeria ${unique()}`))))?.gallery).toBeNull()
  })

  it('relates projects that share a published technology, without itself', async () => {
    const tech = await technology()
    const other = await technology()
    const a = await published(`Rel A ${unique()}`, { technologyIds: [tech.id] })
    const b = await published(`Rel B ${unique()}`, { technologyIds: [tech.id, other.id] })
    await published(`Rel C ${unique()}`, { technologyIds: [other.id] })
    expect((await publicProject(db, 'pt-BR', slugOf(a)))?.related.map(item => item.slug)).toEqual([slugOf(b)])
  })
})
