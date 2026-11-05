// F06-T4: publishing over HTTP. Permissions (publish/schedule are editor and up), strict input, stale versions,
// the audit of every action, the schedule cron run with a moved clock (test-only route), and the 301 an old
// published path answers: cached, tagged `redirects`, no cookie
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test'
import type { Role } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'

const ORIGIN = { origin: SITE_ORIGIN }
const unique = () => randomBytes(4).toString('hex')

async function session(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, role: Role) {
  const request = await playwright.request.newContext({ baseURL })
  expect((await request.post(`/api/_test/session?role=${role}`, { headers: ORIGIN })).status()).toBe(200)
  return request
}

async function article(request: APIRequestContext) {
  const response = await request.post('/api/admin/articles', { headers: ORIGIN, data: { title: `Publicação ${unique()}` } })
  expect(response.status()).toBe(201)
  return (await response.json()) as { id: string, localizations: { slug: string, version: number }[] }
}

const post = (request: APIRequestContext, id: string, action: string, data: unknown) => request.post(`/api/admin/articles/${id}/${action}`, { headers: ORIGIN, data })

test('publish, change the slug and publish again: the old path answers a cached 301', async ({ playwright, baseURL }) => {
  const editor = await session(playwright, baseURL, 'editor')
  const created = await article(editor)
  const oldSlug = created.localizations[0]!.slug
  expect((await post(editor, created.id, 'publish', { locale: 'pt-BR', version: 1 })).status()).toBe(200)
  const newSlug = `${oldSlug}-novo`
  expect((await editor.patch(`/api/admin/articles/${created.id}`, { headers: ORIGIN, data: { version: 1, slug: newSlug } })).status()).toBe(200)
  const republished = await post(editor, created.id, 'publish', { locale: 'pt-BR', version: 2 })
  expect(republished.status()).toBe(200)
  expect((await republished.json()).localizations[0]).toMatchObject({ status: 'published', publishedSlug: newSlug })

  const anonymous = await playwright.request.newContext({ baseURL })
  const redirect = await anonymous.get(`/blog/${oldSlug}`, { maxRedirects: 0 })
  expect(redirect.status()).toBe(301)
  expect(redirect.headers()).toMatchObject({ 'location': `/blog/${newSlug}`, 'cache-control': 'public, max-age=0, s-maxage=604800', 'cache-tag': 'redirects,site' })
  expect(redirect.headers()['set-cookie']).toBeUndefined()
  // F11-T3: HEAD answers the same 301, cached, without a cookie
  const head = await anonymous.head(`/blog/${oldSlug}`, { maxRedirects: 0 })
  expect(head.status()).toBe(301)
  expect(head.headers()).toMatchObject({ 'location': `/blog/${newSlug}`, 'cache-tag': 'redirects,site' })
  expect(head.headers()['set-cookie']).toBeUndefined()
  // Paths that are not articles never reach the redirect table
  expect((await anonymous.get(`/blog/temas/${oldSlug}`, { maxRedirects: 0 })).status()).not.toBe(301)

  const audit = await (await (await session(playwright, baseURL, 'owner')).get('/api/admin/audit?action=article.published&limit=100')).json() as { entries: { entityId: string, metadata: { redirect: boolean } }[] }
  expect(audit.entries.filter(entry => entry.entityId === created.id).map(entry => entry.metadata.redirect).sort()).toEqual([false, true])
})

test('schedule, run the cron with a moved clock, and the article is on the site; unschedule and unpublish', async ({ playwright, baseURL }) => {
  const editor = await session(playwright, baseURL, 'editor')
  const created = await article(editor)
  const at = new Date(Date.now() + 10 * 60 * 1000)
  const scheduled = await post(editor, created.id, 'schedule', { locale: 'pt-BR', version: 1, at: at.toISOString() })
  expect(scheduled.status()).toBe(200)
  expect((await scheduled.json()).localizations[0]).toMatchObject({ status: 'scheduled', scheduledAt: at.toISOString() })

  const early = await editor.post('/api/_test/run-task', { headers: ORIGIN, data: { now: new Date(at.getTime() - 60_000).toISOString(), articleIds: [created.id] } })
  expect((await early.json()).published).toBe(0)
  const due = await editor.post('/api/_test/run-task', { headers: ORIGIN, data: { now: new Date(at.getTime() + 4 * 60_000).toISOString(), articleIds: [created.id] } })
  expect((await due.json()).published).toBe(1)
  const again = await editor.post('/api/_test/run-task', { headers: ORIGIN, data: { now: new Date(at.getTime() + 9 * 60_000).toISOString(), articleIds: [created.id] } })
  expect((await again.json()).published).toBe(0)
  const now = await (await editor.get(`/api/admin/articles/${created.id}`)).json()
  expect(now.localizations[0]).toMatchObject({ status: 'published', scheduledAt: null })

  expect((await post(editor, created.id, 'unpublish', { locale: 'pt-BR' })).status()).toBe(200)
  expect((await post(editor, created.id, 'unpublish', { locale: 'pt-BR' })).status()).toBe(409)
  expect((await post(editor, created.id, 'schedule', { locale: 'pt-BR', version: 1, at: at.toISOString() })).status()).toBe(200)
  expect((await post(editor, created.id, 'unschedule', { locale: 'pt-BR' })).status()).toBe(200)
  expect((await (await editor.get(`/api/admin/articles/${created.id}`)).json()).localizations[0].status).toBe('draft')

  const owner = await session(playwright, baseURL, 'owner')
  for (const action of ['article.scheduled', 'article.published_on_schedule', 'article.unpublished', 'article.unscheduled']) {
    const audit = await (await owner.get(`/api/admin/audit?action=${action}&limit=100`)).json() as { entries: { entityId: string }[] }
    expect(audit.entries.some(entry => entry.entityId === created.id), action).toBe(true)
  }
})

test('only editors and up publish or schedule; input is strict; a stale version is a 409', async ({ playwright, baseURL }) => {
  const owner = await session(playwright, baseURL, 'owner')
  const created = await article(owner)
  const future = new Date(Date.now() + 3600_000).toISOString()
  for (const role of ['author', 'translator', 'viewer'] as const) {
    const request = await session(playwright, baseURL, role)
    for (const [action, data] of [['publish', { locale: 'pt-BR', version: 1 }], ['unpublish', { locale: 'pt-BR' }], ['schedule', { locale: 'pt-BR', version: 1, at: future }], ['unschedule', { locale: 'pt-BR' }]] as const) {
      expect((await post(request, created.id, action, data)).status(), `${role} ${action}`).toBe(403)
    }
  }
  for (const [name, action, data] of [
    ['no version', 'publish', { locale: 'pt-BR' }],
    ['unknown locale', 'publish', { locale: 'it', version: 1 }],
    ['extra field', 'publish', { locale: 'pt-BR', version: 1, force: true }],
    ['past', 'schedule', { locale: 'pt-BR', version: 1, at: new Date(Date.now() - 60_000).toISOString() }],
    ['over a year', 'schedule', { locale: 'pt-BR', version: 1, at: new Date(Date.now() + 400 * 24 * 3600_000).toISOString() }],
    ['no offset', 'schedule', { locale: 'pt-BR', version: 1, at: '2026-12-01T09:00' }],
    ['not a date', 'schedule', { locale: 'pt-BR', version: 1, at: 'amanhã' }],
  ] as const) {
    expect((await post(owner, created.id, action, data)).status(), name).toBe(400)
  }
  const stale = await post(owner, created.id, 'publish', { locale: 'pt-BR', version: 7 })
  expect(stale.status()).toBe(409)
  expect((await stale.json()).data.issues).toEqual([{ path: 'version', message: 'stale' }])
  expect((await post(owner, created.id, 'unschedule', { locale: 'pt-BR' })).status()).toBe(409)
  expect((await owner.post(`/api/admin/articles/${created.id}/publish`, { headers: { origin: 'https://evil.example' }, data: { locale: 'pt-BR', version: 1 } })).status()).toBe(403)
})
