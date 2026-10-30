// F06-T1 (+ F06-T2): the article and topic API over HTTP. Strict validation (unknown fields, bad slugs, hostile documents, media
// and topics that do not exist), the 409s a form shows on a field, the author's own-content rule and the
// tag permissions (security model §4), and one audit row per mutation. Sessions come from the test-only route
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test'
import type { Role } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'

const ORIGIN = { origin: SITE_ORIGIN }
const unique = () => randomBytes(4).toString('hex')

async function session(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, role: Role) {
  const request = await playwright.request.newContext({ baseURL })
  const response = await request.post(`/api/_test/session?role=${role}`, { headers: ORIGIN })
  expect(response.status()).toBe(200)
  return { request, userId: (await response.json()).userId as string }
}

async function createArticle(request: APIRequestContext, title = `Artigo ${unique()}`) {
  const response = await request.post('/api/admin/articles', { headers: ORIGIN, data: { title } })
  expect(response.status(), await response.text()).toBe(201)
  return response.json() as Promise<{ id: string, authorId: string, localizations: { locale: string, slug: string, version: number }[] }>
}

const patch = (request: APIRequestContext, id: string, data: unknown) => request.patch(`/api/admin/articles/${id}`, { headers: ORIGIN, data })

test.describe('articles', () => {
  test('create, read, list, save and delete, each mutation audited', async ({ playwright, baseURL }) => {
    const { request, userId } = await session(playwright, baseURL, 'owner')
    const title = `Primeiros passos ${unique()}`
    const article = await createArticle(request, title)
    expect(article.authorId).toBe(userId)
    const copy = article.localizations[0]!
    expect(copy).toMatchObject({ locale: 'pt-BR', version: 1, slug: `primeiros-passos-${title.split(' ').at(-1)}` })

    const read = await request.get(`/api/admin/articles/${article.id}`)
    expect(read.status()).toBe(200)
    expect(read.headers()['cache-control']).toBe('private, no-store')

    const list = await request.get('/api/admin/articles?status=draft&locale=pt-BR&limit=50')
    expect((await list.json()).items.map((item: { id: string }) => item.id)).toContain(article.id)

    const saved = await patch(request, article.id, {
      version: 1,
      title: 'Novo título',
      excerpt: 'Resumo curto',
      body: { type: 'doc', attrs: { schemaVersion: 1 }, content: [{ type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: '<script>alert(1)</script> texto' }] }] },
      seoTitle: '',
      noindex: true,
    })
    expect(saved.status(), await saved.text()).toBe(200)
    expect((await saved.json()).localizations[0]).toMatchObject({ title: 'Novo título', version: 2, seoTitle: null, noindex: true, wordCount: 5 })

    expect((await request.delete(`/api/admin/articles/${article.id}`, { headers: ORIGIN })).status()).toBe(200)
    expect((await request.get(`/api/admin/articles/${article.id}`)).status()).toBe(404)

    // Saves are autosaves (F06-T2, decision 4): their revision records who and when, so the audit log has the
    // creation and the deletion only
    for (const action of ['article.created', 'article.deleted']) {
      const audit = await (await request.get(`/api/admin/audit?action=${action}&limit=100`)).json() as { entries: { entityId: string }[] }
      expect(audit.entries.some(item => item.entityId === article.id), action).toBe(true)
    }
  })

  test('rejects anything outside the schema', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'owner')
    const article = await createArticle(request)
    const id = article.id
    const media = '01a18000-0000-7000-8000-000000000099'
    for (const [name, data] of [
      ['unknown field', { version: 1, authorId: 'someone-else' }],
      ['no version', { title: 'x' }],
      ['nothing to update', { version: 1 }],
      ['empty title', { version: 1, title: '   ' }],
      ['accented slug', { version: 1, slug: 'ação' }],
      ['slug with spaces', { version: 1, slug: 'a b' }],
      ['slug too long', { version: 1, slug: 'a'.repeat(81) }],
      ['unknown node', { version: 1, body: { type: 'doc', content: [{ type: 'iframe', attrs: { src: 'https://evil.example' } }] } }],
      ['javascript link', { version: 1, body: { type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'p' }, content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] } }],
      ['cover that does not exist', { version: 1, coverMediaId: media }],
      ['body media that does not exist', { version: 1, body: { type: 'doc', content: [{ type: 'image', attrs: { id: 'i', mediaId: media } }] } }],
      ['topic that does not exist', { version: 1, tagIds: [media] }],
      ['repeated topic', { version: 1, tagIds: [media, media] }],
    ] as const) {
      const response = await patch(request, id, data)
      expect(response.status(), name).toBe(400)
    }
    expect((await request.post('/api/admin/articles', { headers: ORIGIN, data: { title: '' } })).status()).toBe(400)
    expect((await request.post('/api/admin/articles', { headers: ORIGIN, data: { title: 'x', slug: 'x' } })).status()).toBe(400)
    expect((await request.get('/api/admin/articles?cursor=nope')).status()).toBe(400)
    expect((await request.get('/api/admin/articles?status=deleted')).status()).toBe(400)
    // Nothing above changed the article
    expect((await (await request.get(`/api/admin/articles/${id}`)).json()).localizations[0].version).toBe(1)
  })

  test('answers 409 on the field: a taken slug and a stale version', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'editor')
    const taken = await createArticle(request)
    const article = await createArticle(request)
    const slug = await patch(request, article.id, { version: 1, slug: taken.localizations[0]!.slug })
    expect(slug.status()).toBe(409)
    expect((await slug.json()).data.issues).toEqual([{ path: 'slug', message: 'slug_taken' }])

    expect((await patch(request, article.id, { version: 1, title: 'Primeira aba' })).status()).toBe(200)
    const stale = await patch(request, article.id, { version: 1, title: 'Segunda aba' })
    expect(stale.status()).toBe(409)
    expect((await stale.json()).data.issues).toEqual([{ path: 'version', message: 'stale' }])
  })

  test('an author edits and deletes only their own drafts; translators and viewers change nothing', async ({ playwright, baseURL }) => {
    const owner = await session(playwright, baseURL, 'owner')
    const author = await session(playwright, baseURL, 'author')
    const others = await createArticle(owner.request)
    const own = await createArticle(author.request)

    expect((await patch(author.request, others.id, { version: 1, title: 'Invadido' })).status()).toBe(403)
    expect((await author.request.delete(`/api/admin/articles/${others.id}`, { headers: ORIGIN })).status()).toBe(403)
    expect((await patch(author.request, own.id, { version: 1, title: 'Meu' })).status()).toBe(200)
    // Others' articles stay readable
    expect((await author.request.get(`/api/admin/articles/${others.id}`)).status()).toBe(200)
    expect((await author.request.delete(`/api/admin/articles/${own.id}`, { headers: ORIGIN })).status()).toBe(200)

    for (const role of ['translator', 'viewer'] as const) {
      const { request } = await session(playwright, baseURL, role)
      expect((await request.get('/api/admin/articles')).status(), role).toBe(200)
      expect((await request.post('/api/admin/articles', { headers: ORIGIN, data: { title: 'x' } })).status(), role).toBe(403)
      expect((await patch(request, others.id, { version: 1, title: 'x' })).status(), role).toBe(403)
      expect((await request.delete(`/api/admin/articles/${others.id}`, { headers: ORIGIN })).status(), role).toBe(403)
    }
    expect((await (await owner.request.get(`/api/admin/articles/${others.id}`)).json()).localizations[0].version).toBe(1)
  })

  test('mutations need the same origin', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'owner')
    const article = await createArticle(request)
    expect((await request.patch(`/api/admin/articles/${article.id}`, { headers: { origin: 'https://evil.example' }, data: { version: 1, title: 'x' } })).status()).toBe(403)
  })
})

test.describe('history (F06-T2)', () => {
  test('named versions and restore: validation, conflicts, permissions and audit', async ({ playwright, baseURL }) => {
    const owner = await session(playwright, baseURL, 'owner')
    const article = await createArticle(owner.request)
    const id = article.id
    expect((await patch(owner.request, id, { version: 1, title: 'Versão boa' })).status()).toBe(200)

    for (const [name, data] of [
      ['no version', { note: 'x' }],
      ['unknown field', { version: 2, kind: 'publish' }],
      ['note too long', { version: 2, note: 'x'.repeat(201) }],
    ] as const) {
      expect((await owner.request.post(`/api/admin/articles/${id}/revisions`, { headers: ORIGIN, data })).status(), name).toBe(400)
    }
    const named = await owner.request.post(`/api/admin/articles/${id}/revisions`, { headers: ORIGIN, data: { version: 2, note: 'Boa' } })
    expect(named.status()).toBe(201)
    const revision = await named.json() as { id: string, number: number, kind: string, note: string }
    expect(revision).toMatchObject({ kind: 'manual', note: 'Boa' })
    // The same note on the same content is a repeat
    expect((await owner.request.post(`/api/admin/articles/${id}/revisions`, { headers: ORIGIN, data: { version: 2, note: 'Boa' } })).status()).toBe(200)
    const stale = await owner.request.post(`/api/admin/articles/${id}/revisions`, { headers: ORIGIN, data: { version: 1, note: null } })
    expect(stale.status()).toBe(409)

    const list = await (await owner.request.get(`/api/admin/articles/${id}/revisions`)).json() as { items: { id: string, kind: string }[] }
    expect(list.items.map(item => item.kind)).toEqual(['manual', 'autosave'])
    const detail = await (await owner.request.get(`/api/admin/articles/${id}/revisions/${revision.id}`)).json()
    expect(detail.snapshot.localization.title).toBe('Versão boa')
    expect(detail).not.toHaveProperty('contentHash')

    expect((await patch(owner.request, id, { version: 2, title: 'Versão ruim' })).status()).toBe(200)
    for (const [name, data, code] of [
      ['stale version', { version: 2, revisionId: revision.id }, 409],
      ['revision that is not this article\'s', { version: 3, revisionId: '01a18000-0000-7000-8000-000000000999' }, 404],
      ['not an id', { version: 3, revisionId: 'x' }, 400],
    ] as const) {
      expect((await owner.request.post(`/api/admin/articles/${id}/restore`, { headers: ORIGIN, data })).status(), name).toBe(code)
    }
    const restored = await owner.request.post(`/api/admin/articles/${id}/restore`, { headers: ORIGIN, data: { version: 3, revisionId: revision.id } })
    expect(restored.status()).toBe(200)
    expect((await restored.json()).localizations[0]).toMatchObject({ title: 'Versão boa', version: 4 })
    const after = await (await owner.request.get(`/api/admin/articles/${id}/revisions`)).json() as { items: { kind: string }[] }
    expect(after.items.map(item => item.kind)).toEqual(['restore', 'autosave', 'manual', 'autosave'])

    for (const action of ['article.version_saved', 'article.restored']) {
      const audit = await (await owner.request.get(`/api/admin/audit?action=${action}&limit=100`)).json() as { entries: { entityId: string, metadata: { revision: number } | null }[] }
      expect(audit.entries.find(item => item.entityId === id)?.metadata, action).toEqual({ revision: revision.number })
    }

    // Authors only on their own articles; translators and viewers read but never write history
    const author = await session(playwright, baseURL, 'author')
    expect((await author.request.post(`/api/admin/articles/${id}/revisions`, { headers: ORIGIN, data: { version: 4 } })).status()).toBe(403)
    expect((await author.request.post(`/api/admin/articles/${id}/restore`, { headers: ORIGIN, data: { version: 4, revisionId: revision.id } })).status()).toBe(403)
    expect((await author.request.get(`/api/admin/articles/${id}/revisions`)).status()).toBe(200)
    for (const role of ['translator', 'viewer'] as const) {
      const { request } = await session(playwright, baseURL, role)
      expect((await request.get(`/api/admin/articles/${id}/revisions/${revision.id}`)).status(), role).toBe(200)
      expect((await request.post(`/api/admin/articles/${id}/revisions`, { headers: ORIGIN, data: { version: 4 } })).status(), role).toBe(403)
      expect((await request.post(`/api/admin/articles/${id}/restore`, { headers: ORIGIN, data: { version: 4, revisionId: revision.id } })).status(), role).toBe(403)
    }
  })

  test('two sessions saving the same version: the second gets 409 and nothing is overwritten', async ({ playwright, baseURL }) => {
    const first = await session(playwright, baseURL, 'editor')
    const second = await session(playwright, baseURL, 'editor')
    const article = await createArticle(first.request)
    expect((await patch(first.request, article.id, { version: 1, excerpt: 'Primeira sessão' })).status()).toBe(200)
    const conflict = await patch(second.request, article.id, { version: 1, excerpt: 'Segunda sessão' })
    expect(conflict.status()).toBe(409)
    expect((await conflict.json()).data.issues).toEqual([{ path: 'version', message: 'stale' }])
    const now = await (await second.request.get(`/api/admin/articles/${article.id}`)).json()
    expect(now.localizations[0]).toMatchObject({ excerpt: 'Primeira sessão', version: 2 })
  })
})

test.describe('topics', () => {
  test('authors create topics but cannot rename or delete them; a used topic cannot be deleted', async ({ playwright, baseURL }) => {
    const author = await session(playwright, baseURL, 'author')
    const editor = await session(playwright, baseURL, 'editor')
    const created = await author.request.post('/api/admin/tags', { headers: ORIGIN, data: { name: `Segurança ${unique()}` } })
    expect(created.status()).toBe(201)
    const topic = await created.json() as { id: string, slug: string }
    expect(topic.slug).toMatch(/^seguranca-/)

    expect((await author.request.patch(`/api/admin/tags/${topic.id}`, { headers: ORIGIN, data: { name: 'x' } })).status()).toBe(403)
    expect((await author.request.delete(`/api/admin/tags/${topic.id}`, { headers: ORIGIN })).status()).toBe(403)
    const duplicate = await editor.request.post('/api/admin/tags', { headers: ORIGIN, data: { name: 'Outro', slug: topic.slug } })
    expect(duplicate.status()).toBe(409)
    expect((await editor.request.post('/api/admin/tags', { headers: ORIGIN, data: { name: '!!!' } })).status()).toBe(400)
    expect((await editor.request.post('/api/admin/tags', { headers: ORIGIN, data: { name: 'x', kind: 'technology' } })).status()).toBe(400)

    const article = await createArticle(author.request)
    expect((await patch(author.request, article.id, { version: 1, tagIds: [topic.id] })).status()).toBe(200)
    const inUse = await editor.request.delete(`/api/admin/tags/${topic.id}`, { headers: ORIGIN })
    expect(inUse.status()).toBe(409)
    expect((await inUse.json()).data.issues).toEqual([{ path: 'uses', message: '1' }])

    expect((await editor.request.patch(`/api/admin/tags/${topic.id}`, { headers: ORIGIN, data: { name: 'Segurança web' } })).status()).toBe(200)
    expect((await patch(author.request, article.id, { version: 2, tagIds: [] })).status()).toBe(200)
    expect((await editor.request.delete(`/api/admin/tags/${topic.id}`, { headers: ORIGIN })).status()).toBe(200)

    for (const role of ['translator', 'viewer'] as const) {
      const { request } = await session(playwright, baseURL, role)
      expect((await request.get('/api/admin/tags')).status(), role).toBe(200)
      expect((await request.post('/api/admin/tags', { headers: ORIGIN, data: { name: 'x' } })).status(), role).toBe(403)
    }
  })
})
