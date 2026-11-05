// F07-T1: projects over HTTP. Permissions (an author edits only the projects they created and cannot publish or
// reorder; an editor does both), strict input (https: links only, highlights with a label and a value), the
// case-study template, history and restore, publish and unpublish with the purge and audit, the 301 from an old
// translated path, the manual order (409 for a stale list) and technologies as a kind of tag
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test'
import type { Role } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'

const ORIGIN = { origin: SITE_ORIGIN }
const unique = () => randomBytes(4).toString('hex')

interface Project {
  id: string
  sortOrder: number
  technologyIds: string[]
  localizations: { slug: string, version: number, status: string, body: { content: { type: string }[] }, highlights: unknown[] }[]
}

async function session(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, role: Role) {
  const request = await playwright.request.newContext({ baseURL })
  const response = await request.post(`/api/_test/session?role=${role}`, { headers: ORIGIN })
  expect(response.status()).toBe(200)
  return Object.assign(request, { userId: (await response.json()).userId as string })
}

async function create(request: APIRequestContext, title = `Projeto ${unique()}`): Promise<Project> {
  const response = await request.post('/api/admin/projects', { headers: ORIGIN, data: { title } })
  expect(response.status(), await response.text()).toBe(201)
  return response.json()
}

const patch = (request: APIRequestContext, id: string, data: unknown) => request.patch(`/api/admin/projects/${id}`, { headers: ORIGIN, data })
const post = (request: APIRequestContext, id: string, action: string, data: unknown) => request.post(`/api/admin/projects/${id}/${action}`, { headers: ORIGIN, data })

test('an author creates and edits their own project; others cannot, nor can the author publish', async ({ playwright, baseURL }) => {
  const author = await session(playwright, baseURL, 'author')
  const project = await create(author)
  const copy = project.localizations[0]!
  expect(copy).toMatchObject({ status: 'draft', version: 1, highlights: [] })
  expect(copy.body.content.filter(block => block.type === 'heading')).toHaveLength(4)

  const saved = await patch(author, project.id, { version: 1, summary: 'Resumo', role: 'Dev', highlights: [{ label: 'Usuários', value: '1.200', note: 'Painel de analytics' }], repoUrl: 'https://github.com/x/y', periodStart: '2024-02' })
  expect(saved.status(), await saved.text()).toBe(200)
  expect((await saved.json()).repoUrl).toBe('https://github.com/x/y')

  const other = await session(playwright, baseURL, 'author')
  expect((await patch(other, project.id, { version: 2, summary: 'Outro' })).status()).toBe(403)
  expect((await post(author, project.id, 'publish', { locale: 'pt-BR', version: 2 })).status()).toBe(403)
  expect((await author.put('/api/admin/projects/order', { headers: ORIGIN, data: { ids: [project.id] } })).status()).toBe(403)
  const viewer = await session(playwright, baseURL, 'viewer')
  expect((await viewer.post('/api/admin/projects', { headers: ORIGIN, data: { title: 'Não' } })).status()).toBe(403)
  expect((await viewer.get(`/api/admin/projects/${project.id}`)).status()).toBe(200)
})

test('input is strict: https: links, highlights with label and value, a period in order', async ({ playwright, baseURL }) => {
  const editor = await session(playwright, baseURL, 'editor')
  const project = await create(editor)
  for (const data of [
    { version: 1, demoUrl: 'http://example.com' },
    { version: 1, repoUrl: 'javascript:alert(1)' },
    { version: 1, highlights: [{ label: 'Sem valor', value: '' }] },
    { version: 1, highlights: [{ label: 'Extra', value: '1', invented: true }] },
    { version: 1, periodStart: '2024-13' },
    { version: 1, unknown: 1 },
  ]) {
    const response = await patch(editor, project.id, data)
    expect(response.status(), JSON.stringify(data)).toBe(400)
  }
  const reversed = await patch(editor, project.id, { version: 1, periodStart: '2024-06', periodEnd: '2024-01' })
  expect(reversed.status()).toBe(400)
  expect((await reversed.json()).data.issues).toEqual([{ path: 'periodEnd', message: 'must not be before the start' }])
  // An empty link clears it
  expect((await (await patch(editor, project.id, { version: 1, demoUrl: '' })).json()).demoUrl).toBeNull()
})

test('history, restore, publish with technologies, a 301 from the old path, unpublish; all audited', async ({ playwright, baseURL }) => {
  const editor = await session(playwright, baseURL, 'editor')
  const tech = await editor.post('/api/admin/tags', { headers: ORIGIN, data: { name: `Tech ${unique()}`, kind: 'technology' } })
  expect(tech.status()).toBe(201)
  const technologyId = (await tech.json()).id as string
  expect(((await (await editor.get('/api/admin/tags?kind=technology')).json()).items as { id: string }[]).map(item => item.id)).toContain(technologyId)
  expect(((await (await editor.get('/api/admin/tags')).json()).items as { id: string }[]).map(item => item.id)).not.toContain(technologyId)
  expect((await editor.get('/api/admin/tags?kind=other')).status()).toBe(400)

  const project = await create(editor)
  const oldSlug = project.localizations[0]!.slug
  expect((await patch(editor, project.id, { version: 1, summary: 'Primeira versão', technologyIds: [technologyId] })).status()).toBe(200)
  const version = await post(editor, project.id, 'revisions', { version: 2, note: 'Marco' })
  expect(version.status()).toBe(201)
  const revisionId = (await version.json()).id as string
  expect((await patch(editor, project.id, { version: 2, summary: 'Segunda versão' })).status()).toBe(200)
  const restored = await post(editor, project.id, 'restore', { version: 3, revisionId })
  expect(restored.status(), await restored.text()).toBe(200)
  expect((await restored.json()).localizations[0]).toMatchObject({ summary: 'Primeira versão', version: 4 })
  const history = (await (await editor.get(`/api/admin/projects/${project.id}/revisions`)).json()).items as { kind: string }[]
  expect(history.map(item => item.kind)).toEqual(expect.arrayContaining(['restore', 'manual', 'autosave']))

  const published = await post(editor, project.id, 'publish', { locale: 'pt-BR', version: 4 })
  expect(published.status(), await published.text()).toBe(200)
  expect((await published.json()).localizations[0]).toMatchObject({ status: 'published', publishedSlug: oldSlug })

  expect((await patch(editor, project.id, { version: 4, slug: `${oldSlug}-novo` })).status()).toBe(200)
  expect((await post(editor, project.id, 'publish', { locale: 'pt-BR', version: 5 })).status()).toBe(200)
  const anonymous = await playwright.request.newContext({ baseURL })
  const redirect = await anonymous.get(`/projetos/${oldSlug}`, { maxRedirects: 0 })
  expect(redirect.status()).toBe(301)
  expect(redirect.headers()).toMatchObject({ 'location': `/projetos/${oldSlug}-novo`, 'cache-tag': 'redirects,site' })
  expect(redirect.headers()['set-cookie']).toBeUndefined()

  expect((await editor.delete(`/api/admin/projects/${project.id}`, { headers: ORIGIN })).status()).toBe(409)
  expect((await post(editor, project.id, 'unpublish', { locale: 'pt-BR' })).status()).toBe(200)
  // A technology a project uses cannot be deleted
  expect((await editor.delete(`/api/admin/tags/${technologyId}`, { headers: ORIGIN })).status()).toBe(409)
  expect((await editor.delete(`/api/admin/projects/${project.id}`, { headers: ORIGIN })).status()).toBe(200)

  const owner = await session(playwright, baseURL, 'owner')
  const audit = (await (await owner.get(`/api/admin/audit?limit=100&actor=${editor.userId}`)).json()).entries as { action: string, entityId: string }[]
  expect(audit.filter(entry => entry.entityId === project.id).map(entry => entry.action)).toEqual(expect.arrayContaining([
    'project.created', 'project.version_saved', 'project.restored', 'project.published', 'project.unpublished', 'project.deleted',
  ]))
})

test('the manual order saves the whole list and refuses a stale one', async ({ playwright, baseURL }) => {
  const editor = await session(playwright, baseURL, 'editor')
  const first = await create(editor)
  const second = await create(editor)
  // Only these two swap, so projects of other specs keep their places; a project created meanwhile makes the list
  // stale, and the list is read again
  for (let attempt = 0; ; attempt++) {
    const ids = ((await (await editor.get('/api/admin/projects')).json()).items as { id: string }[]).map(item => item.id)
    const swapped = ids.map(id => (id === first.id ? second.id : id === second.id ? first.id : id))
    const response = await editor.put('/api/admin/projects/order', { headers: ORIGIN, data: { ids: swapped } })
    if (response.status() === 409 && attempt < 3) {
      continue
    }
    expect(response.status()).toBe(200)
    expect(((await response.json()).items as { id: string }[]).map(item => item.id)).toEqual(swapped)
    expect((await editor.put('/api/admin/projects/order', { headers: ORIGIN, data: { ids: swapped.slice(1) } })).status()).toBe(409)
    break
  }
  expect((await editor.put('/api/admin/projects/order', { headers: ORIGIN, data: { ids: [] } })).status()).toBe(400)
})
