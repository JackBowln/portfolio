// F09-T2: the glossary over HTTP. Reading needs translation:review, editing translation:approve; the input is strict
// (unknown keys, a kept term with a translation, pt-BR as a locale → 400); a duplicate is a 409; every change is
// audited with the id only
import { expect, test } from '@playwright/test'
import type { PlaywrightWorkerArgs } from '@playwright/test'
import { can } from '../../shared/auth/permissions'
import { ROLES } from '../../shared/types/enums'
import type { Role } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'

const ORIGIN = { origin: SITE_ORIGIN }

async function session(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, role: Role) {
  const request = await playwright.request.newContext({ baseURL })
  expect((await request.post(`/api/_test/session?role=${role}`, { headers: ORIGIN })).status()).toBe(200)
  return request
}

test('reading and editing follow translation:review and translation:approve', async ({ playwright, baseURL }) => {
  for (const role of ROLES) {
    const request = await session(playwright, baseURL, role)
    expect((await request.get('/api/admin/glossary')).status(), role).toBe(can(role, { translation: ['review'] }) ? 200 : 403)
    const created = await request.post('/api/admin/glossary', { headers: ORIGIN, data: { term: `Termo ${role} ${crypto.randomUUID().slice(0, 6)}`, doNotTranslate: true } })
    expect(created.status(), role).toBe(can(role, { translation: ['approve'] }) ? 200 : 403)
  }
})

test('strict input, duplicates refused, every change audited without the text', async ({ playwright, baseURL }) => {
  const editor = await session(playwright, baseURL, 'editor')
  const term = `Borda ${crypto.randomUUID().slice(0, 6)}`
  for (const data of [{ term, doNotTranslate: true, translation: 'x' }, { term, translation: 'Edge', locale: 'pt-BR' }, { term, translation: 'Edge', extra: 1 }, { term: '', translation: 'x' }]) {
    expect((await editor.post('/api/admin/glossary', { headers: ORIGIN, data })).status(), JSON.stringify(data)).toBe(400)
  }
  const created = await editor.post('/api/admin/glossary', { headers: ORIGIN, data: { term, translation: 'Edge', locale: 'en' } })
  expect(created.status()).toBe(200)
  const { id } = await created.json() as { id: string }
  expect((await editor.post('/api/admin/glossary', { headers: ORIGIN, data: { term: term.toLowerCase(), translation: 'Rim', locale: 'en' } })).status()).toBe(409)
  const patched = await editor.patch(`/api/admin/glossary/${id}`, { headers: ORIGIN, data: { term, translation: 'Border', locale: 'en' } })
  expect((await patched.json()).translation).toBe('Border')
  expect((await editor.delete(`/api/admin/glossary/${id}`, { headers: ORIGIN })).status()).toBe(200)

  const owner = await session(playwright, baseURL, 'owner')
  for (const action of ['glossary.created', 'glossary.updated', 'glossary.deleted']) {
    const { entries } = await (await owner.get(`/api/admin/audit?action=${action}`)).json() as { entries: { entityId: string }[] }
    const found = entries.find(item => item.entityId === id)
    expect(found, action).toBeDefined()
    expect(JSON.stringify(found)).not.toContain(term)
  }
})
