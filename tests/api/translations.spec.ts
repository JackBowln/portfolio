// F09-T1: the dashboard's translation summary over HTTP. Whoever reviews translations reads it (translation:review:
// owner, admin, editor, translator); authors and viewers do not. Per entity type and target locale, the pending
// counts of each state, never pt-BR
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { can } from '../../shared/auth/permissions'
import { ROLES } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'

test('only translation reviewers read the summary, per entity and target locale', async ({ playwright, baseURL }) => {
  for (const role of ROLES) {
    const request = await playwright.request.newContext({ baseURL })
    expect((await request.post(`/api/_test/session?role=${role}`, { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
    const response = await request.get('/api/admin/translations/summary')
    expect(response.status(), role).toBe(can(role, { translation: ['review'] }) ? 200 : 403)
    if (response.status() !== 200) {
      continue
    }
    const summary = await response.json() as { locales: string[], rows: { entity: string, locales: Record<string, Record<string, number>> }[] }
    expect(summary.locales).toEqual(['en', 'es', 'de', 'fr'])
    expect(summary.rows.map(row => row.entity)).toEqual(['article', 'project', 'page', 'tag', 'media', 'setting'])
    for (const row of summary.rows) {
      expect(Object.keys(row.locales)).toEqual(['en', 'es', 'de', 'fr'])
      for (const counts of Object.values(row.locales)) {
        expect(Object.keys(counts)).toEqual(['missing', 'machine', 'in_review', 'outdated'])
        expect(Object.values(counts).every(value => Number.isInteger(value) && value >= 0)).toBe(true)
      }
    }
  }
})

// F09-T3: AI translation over HTTP, with the fake provider of the test build (TRANSLATION_PROVIDER=fake). Estimating
// and running need translation:run; running needs `confirm: true`; the job, the usage and the audit follow
test.describe('AI translation jobs', () => {
  async function enableAi(owner: APIRequestContext) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { items } = await (await owner.get('/api/admin/settings')).json() as { items: { key: string, version: number, value: Record<string, unknown> }[] }
      const ai = items.find(item => item.key === 'ai_translation')!
      const value = { ...ai.value, enabled: true, model: '@cf/qwen/qwen3-30b-a3b-fp8', dailyNeuronCap: 10_000, perJobNeuronCap: 10_000 }
      const saved = await owner.put('/api/admin/settings/ai_translation', { headers: { origin: SITE_ORIGIN }, data: { version: ai.version, value } })
      if (saved.status() === 200) {
        return
      }
      expect(saved.status()).toBe(409)
    }
    throw new Error('could not switch the AI on')
  }

  test('estimate, confirm, run; permissions; job, usage and audit', async ({ playwright, baseURL }) => {
    const headers = { origin: SITE_ORIGIN }
    const contextFor = async (role: (typeof ROLES)[number]) => {
      const request = await playwright.request.newContext({ baseURL })
      expect((await request.post(`/api/_test/session?role=${role}`, { headers })).status()).toBe(200)
      return request
    }
    await enableAi(await contextFor('owner'))
    const editor = await contextFor('editor')
    const title = `Tradução API ${crypto.randomUUID().slice(0, 6)}`
    const created = await editor.post('/api/admin/articles', { headers, data: { title } })
    const { id } = await created.json() as { id: string }
    expect((await editor.patch(`/api/admin/articles/${id}`, { headers, data: { version: 1, excerpt: 'Resumo' } })).status()).toBe(200)
    expect((await editor.post(`/api/admin/articles/${id}/publish`, { headers, data: { locale: 'pt-BR', version: 2 } })).status()).toBe(200)

    for (const role of ROLES) {
      const request = role === 'editor' ? editor : await contextFor(role)
      const response = await request.post('/api/admin/translations/estimate', { headers, data: { entityType: 'article', entityId: id, locale: 'de' } })
      expect(response.status(), role).toBe(can(role, { translation: ['run'] }) ? 200 : 403)
    }
    expect((await editor.post('/api/admin/translations/estimate', { headers, data: { entityType: 'article', entityId: id, locale: 'pt-BR' } })).status()).toBe(400)

    const estimate = await (await editor.post('/api/admin/translations/estimate', { headers, data: { entityType: 'article', entityId: id, locale: 'es' } })).json() as { id: string, status: string, blocked: string | null }
    expect(estimate).toMatchObject({ status: 'estimated', blocked: null })
    expect((await editor.post('/api/admin/translations/run', { headers, data: { jobId: estimate.id } })).status()).toBe(400)
    expect((await editor.post('/api/admin/translations/run', { headers, data: { jobId: estimate.id, confirm: false } })).status()).toBe(400)
    const run = await editor.post('/api/admin/translations/run', { headers, data: { jobId: estimate.id, confirm: true } })
    expect(run.status(), await run.text()).toBe(200)
    expect(await run.json()).toMatchObject({ status: 'succeeded', failedSegments: [] })

    expect(await (await editor.get(`/api/admin/translations/jobs/${estimate.id}`)).json()).toMatchObject({ status: 'succeeded', locale: 'es' })
    const usage = await (await editor.get('/api/admin/translations/usage')).json() as { today: { neurons: number, cap: number } }
    expect(usage.today.neurons).toBeGreaterThan(0)
    const article = await (await editor.get(`/api/admin/articles/${id}`)).json() as { localizations: { locale: string, translationState: string, status: string }[] }
    expect(article.localizations.find(copy => copy.locale === 'es')).toMatchObject({ translationState: 'machine', status: 'draft' })

    const owner = await contextFor('owner')
    const { entries } = await (await owner.get('/api/admin/audit?action=translation.completed')).json() as { entries: { entityId: string, metadata: Record<string, unknown> }[] }
    expect(entries.find(entry => entry.entityId === id)?.metadata).toMatchObject({ job: estimate.id, locale: 'es' })
  })
})

// F09-T5: short texts in batch. Reading needs translation:review, approving translation:approve; settings texts also
// need settings:update, so an editor cannot change them
test('short texts: read, approve and settings permissions', async ({ playwright, baseURL }) => {
  const headers = { origin: SITE_ORIGIN }
  for (const role of ROLES) {
    const request = await playwright.request.newContext({ baseURL })
    expect((await request.post(`/api/_test/session?role=${role}`, { headers })).status()).toBe(200)
    expect((await request.get('/api/admin/translations/texts?locale=de')).status(), role).toBe(can(role, { translation: ['review'] }) ? 200 : 403)
    const approve = await request.post('/api/admin/translations/texts/approve', { headers, data: { locale: 'de', keys: ['setting:unknown'] } })
    expect(approve.status(), role).toBe(can(role, { translation: ['approve'] }) ? 400 : 403)
  }
  const editor = await playwright.request.newContext({ baseURL })
  await editor.post('/api/_test/session?role=editor', { headers })
  const { items } = await (await editor.get('/api/admin/translations/texts?locale=de')).json() as { items: { key: string, kind: string, fields: { name: string }[] }[] }
  const setting = items.find(item => item.kind === 'setting')
  test.skip(!setting, 'needs a localized setting with a pt-BR text')
  const response = await editor.patch('/api/admin/translations/texts', { headers, data: { locale: 'de', items: [{ key: setting!.key, fields: { [setting!.fields[0]!.name]: 'Text' } }] } })
  expect(response.status()).toBe(403)
  expect((await editor.get('/api/admin/translations/texts?locale=pt-BR')).status()).toBe(400)
})
