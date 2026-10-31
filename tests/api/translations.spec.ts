// F09-T1: the dashboard's translation summary over HTTP. Whoever reviews translations reads it (translation:review:
// owner, admin, editor, translator); authors and viewers do not. Per entity type and target locale, the pending
// counts of each state, never pt-BR
import { expect, test } from '@playwright/test'
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
