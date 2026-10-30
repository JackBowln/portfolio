// F07-T1: projects on a real D1, through the core they share with articles. Create with the case-study sections
// and at the end of the order; save the entity fields (gallery, technologies, period, https links, highlights) with
// their media uses; history, named versions and restore; the manual order; publish with technologies in order,
// alt checks on the gallery, redirects on the translated path and the purge; unpublish; delete
import { env } from 'cloudflare:test'
import { and, asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { auditLog, mediaLocalizations, mediaUsages, projectTechnologies, redirects, users } from '../../server/db/schema'
import type { media } from '../../server/db/schema'
import {
  createProject,
  deleteProject,
  getProject,
  listProjectRevisions,
  listProjects,
  publishProject,
  reorderProjects,
  restoreProjectRevision,
  saveProjectVersion,
  unpublishProject,
  updateProject,
} from '../../server/services/content/projects.service'
import { createTag, removeTag } from '../../server/services/content/tags.service'
import { insertMedia, markReady } from '../../server/services/media/media.repo'
import { projectUpdateSchema, PROJECT_SECTIONS } from '../../shared/content/project-input'
import { documentSchema } from '../../shared/content/document-schema'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Projetista', email: `projects-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const actor = { userId, ip: null, ipHashSalt: undefined }
const unique = () => uuidv7().slice(-8)
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))
const sha = () => [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')
const ptBR = (project: { localizations: { locale: string }[] }) => project.localizations.find(item => item.locale === 'pt-BR')! as Awaited<ReturnType<typeof getProject>>['localizations'][number]
const technology = async () => (await createTag(db, userId, 'technology', { name: `Tecnologia ${unique()}` })).id

async function image(alt: string | null) {
  const hash = sha()
  const row: typeof media.$inferInsert = { id: uuidv7(), kind: 'image', mimeType: 'image/jpeg', originalFilename: 'f.jpg', sizeBytes: 1, width: 10, height: 10, sha256: hash, originalKey: `originals/${hash}.jpg`, variants: [] }
  await insertMedia(db, row, [])
  await markReady(db, row.id!)
  if (alt !== null) {
    await db.insert(mediaLocalizations).values({ mediaId: row.id!, locale: 'pt-BR', alt, translationState: 'source' })
  }
  return row.id!
}

describe('projects', () => {
  it('starts as a draft with the case-study sections, at the end of the order', async () => {
    const first = await createProject(db, userId, `Projeto ${unique()}`)
    const second = await createProject(db, userId, `Projeto ${unique()}`)
    const copy = ptBR(first)
    expect(copy).toMatchObject({ status: 'draft', translationState: 'source', version: 1, summary: '', role: '', highlights: [] })
    expect(documentSchema.safeParse(copy.body).success).toBe(true)
    expect(copy.body.content.filter(block => block.type === 'heading').map(block => (block.content?.[0] as { text: string }).text)).toEqual([...PROJECT_SECTIONS])
    expect(second.sortOrder).toBe(first.sortOrder + 1)
    expect(first.authorId).toBe(userId)
  })

  it('saves the entity fields with their media uses and checks them', async () => {
    const [cover, one, two] = [await image('Capa'), await image('Um'), await image('Dois')]
    const tech = await technology()
    const project = await createProject(db, userId, `Campos ${unique()}`)
    const saved = await updateProject(db, userId, project, {
      version: 1,
      summary: 'Resumo',
      role: 'Desenvolvedor',
      highlights: [{ label: 'Tempo de build', value: '-40%', note: 'Medido no CI' }],
      coverMediaId: cover,
      galleryMediaIds: [one, two],
      technologyIds: [tech],
      periodStart: '2024-01',
      periodEnd: '2024-06',
      repoUrl: 'https://github.com/example/repo',
      demoUrl: null,
      featured: true,
    })
    expect(saved).toMatchObject({ coverMediaId: cover, galleryMediaIds: [one, two], technologyIds: [tech], periodStart: '2024-01', periodEnd: '2024-06', repoUrl: 'https://github.com/example/repo', featured: true })
    expect(ptBR(saved)).toMatchObject({ version: 2, summary: 'Resumo', role: 'Desenvolvedor', highlights: [{ label: 'Tempo de build', value: '-40%', note: 'Medido no CI' }] })
    const uses = await db.select({ mediaId: mediaUsages.mediaId, context: mediaUsages.context }).from(mediaUsages)
      .where(and(eq(mediaUsages.entityType, 'project'), eq(mediaUsages.entityId, project.id)))
    expect(uses.map(use => `${use.context}:${use.mediaId}`).sort()).toEqual([`cover:${cover}`, `gallery:${one}`, `gallery:${two}`].sort())

    // A partial save keeps the other fields
    const titled = await updateProject(db, userId, saved, { version: 2, title: 'Novo título' })
    expect(titled).toMatchObject({ galleryMediaIds: [one, two], periodStart: '2024-01' })

    const missing = uuidv7()
    expect(await errorOf(updateProject(db, userId, titled, { version: 3, periodStart: '2025-01' }))).toMatchObject({ statusCode: 400, data: { issues: [{ path: 'periodEnd' }] } })
    expect(await errorOf(updateProject(db, userId, titled, { version: 3, technologyIds: [missing] }))).toMatchObject({ statusCode: 400, data: { issues: [{ path: 'technologyIds' }] } })
    expect(await errorOf(updateProject(db, userId, titled, { version: 3, galleryMediaIds: [missing] }))).toMatchObject({ statusCode: 400, data: { issues: [{ path: 'galleryMediaIds' }] } })
    expect(await errorOf(updateProject(db, userId, titled, { version: 1, title: 'Velho' }))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'version', message: 'stale' }] } })
  })

  it('accepts only https: links and highlights with a label and a value', () => {
    const parse = (input: object) => projectUpdateSchema.safeParse({ version: 1, ...input }).success
    expect(parse({ repoUrl: 'https://github.com/x/y' })).toBe(true)
    expect(parse({ repoUrl: '' })).toBe(true)
    for (const url of ['http://example.com', 'javascript:alert(1)', 'ftp://example.com', 'https://', 'example.com']) {
      expect(parse({ demoUrl: url }), url).toBe(false)
    }
    expect(parse({ highlights: [{ label: 'Usuários', value: '1.200' }] })).toBe(true)
    expect(parse({ highlights: [{ label: '', value: '1' }] })).toBe(false)
    expect(parse({ highlights: [{ label: 'Sem valor', value: ' ' }] })).toBe(false)
    expect(parse({ highlights: Array.from({ length: 7 }, (_, index) => ({ label: `L${index}`, value: 'v' })) })).toBe(false)
    expect(parse({ periodStart: '2024-13' })).toBe(false)
    expect(parse({ unknown: true })).toBe(false)
  })

  it('records versions and restores an older one without deleting any', async () => {
    const tech = await technology()
    const project = await createProject(db, userId, `Histórico ${unique()}`)
    const first = await updateProject(db, userId, project, { version: 1, summary: 'Primeiro', technologyIds: [tech], periodStart: '2023-03' })
    const { revision, created } = await saveProjectVersion(db, userId, first, { version: 2, note: 'Antes da mudança' })
    expect(created).toBe(true)
    const changed = await updateProject(db, userId, first, { version: 2, summary: 'Segundo', technologyIds: [], periodStart: null })
    await removeTag(db, tech)
    const { project: restored, restored: number } = await restoreProjectRevision(db, userId, changed, { version: 3, revisionId: revision.id })
    expect(number).toBe(revision.number)
    expect(ptBR(restored).summary).toBe('Primeiro')
    // The period comes back; the technology deleted since does not
    expect(restored).toMatchObject({ periodStart: '2023-03', technologyIds: [] })
    const kinds = (await listProjectRevisions(db, restored)).map(item => item.kind)
    expect(kinds[0]).toBe('restore')
    expect(kinds).toContain('manual')
  })

  it('keeps the manual order of every project, and refuses a stale list', async () => {
    const projects = [await createProject(db, userId, `Ordem ${unique()}`), await createProject(db, userId, `Ordem ${unique()}`)]
    const ids = (await listProjects(db)).items.map(item => item.id)
    const reversed = [...ids].reverse()
    await reorderProjects(db, userId, reversed)
    expect((await listProjects(db)).items.map(item => item.id)).toEqual(reversed)
    expect(await errorOf(reorderProjects(db, userId, reversed.filter(id => id !== projects[0]!.id)))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'ids' }] } })
  })

  it('publishes with technologies in order, alt checks on the gallery and the purge; unpublishes and deletes', async () => {
    const [a, b] = [await technology(), await technology()]
    const noAlt = await image(null)
    const project = await createProject(db, userId, `Publicar ${unique()}`)
    const saved = await updateProject(db, userId, project, { version: 1, summary: 'No site', technologyIds: [b, a], galleryMediaIds: [noAlt] })
    expect(await errorOf(publishProject(db, actor, saved, 'pt-BR', 2))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'media', message: `missing_alt:${noAlt}` }] } })

    const fixed = await updateProject(db, userId, saved, { version: 2, galleryMediaIds: [] })
    const { article: published, purge } = await publishProject(db, actor, fixed, 'pt-BR', 3)
    expect(ptBR(published)).toMatchObject({ status: 'published', publishedSummary: 'No site', publishedSlug: ptBR(fixed).slug })
    expect(await db.select({ tagId: projectTechnologies.tagId, position: projectTechnologies.position }).from(projectTechnologies)
      .where(eq(projectTechnologies.projectId, project.id)).orderBy(asc(projectTechnologies.position))).toEqual([{ tagId: b, position: 0 }, { tagId: a, position: 1 }])
    expect(purge).toEqual([`project:${project.id}:pt-BR`, 'list:projects:pt-BR', 'page:home:pt-BR', 'sitemap', `tag:${b}`, `tag:${a}`])
    expect(await db.select().from(auditLog).where(and(eq(auditLog.entityId, project.id), eq(auditLog.action, 'project.published')))).toHaveLength(1)

    // A new published slug leaves a 301 from the translated path
    const renamed = await updateProject(db, userId, published, { version: 3, slug: `${ptBR(fixed).slug}-novo` })
    await publishProject(db, actor, renamed, 'pt-BR', 4)
    const [redirect] = await db.select().from(redirects).where(eq(redirects.fromPath, `/projetos/${ptBR(fixed).slug}`))
    expect(redirect).toMatchObject({ toPath: `/projetos/${ptBR(fixed).slug}-novo`, entityType: 'project', entityId: project.id })

    expect(await errorOf(deleteProject(db, userId, await getProject(db, project.id)))).toMatchObject({ statusCode: 409 })
    const { article: unpublished } = await unpublishProject(db, actor, await getProject(db, project.id), 'pt-BR')
    expect(ptBR(unpublished)).toMatchObject({ status: 'unpublished', publishedRevisionId: null, publishedSummary: null })
    expect(await db.select().from(projectTechnologies).where(eq(projectTechnologies.projectId, project.id))).toEqual([])
    await deleteProject(db, userId, unpublished)
    expect(await errorOf(getProject(db, project.id))).toMatchObject({ statusCode: 404 })
  })
})
