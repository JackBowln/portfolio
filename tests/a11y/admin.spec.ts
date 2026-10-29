// F03-T5: the admin screens meet WCAG 2.2 AA (no serious or critical axe violations), in both themes
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'

const SCREENS = [
  { path: '/admin', heading: 'Painel' },
  { path: '/admin/conta/sessoes', heading: 'Sessões' },
  { path: '/admin/auditoria', heading: 'Auditoria' },
  { path: '/admin/conta/passkeys', heading: 'Passkeys' },
]

for (const colorScheme of ['light', 'dark'] as const) {
  for (const { path, heading } of SCREENS) {
    test(`${path} has no serious or critical axe violations (${colorScheme})`, async ({ page, context }) => {
      // TEST_AUTH route: exists only in the test build
      expect((await context.request.post('/api/_test/session?role=owner', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await page.waitForLoadState('networkidle')

      await expectNoBlockingViolations(page)
    })
  }
}
