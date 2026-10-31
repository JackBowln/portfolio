// F08-T2: the institutional pages pass axe in both themes: published (pt-BR), in fallback (German), empty (contact)
// and privacy with its list of handled data
import { expect, test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'
import { ensureBlogFixture } from '../support/blog'

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

for (const theme of ['light', 'dark'] as const) {
  for (const path of ['/', '/sobre', '/de/ueber-mich', '/contato', '/privacidade']) {
    test(`${path} has no serious or critical axe violations (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoBlockingViolations(page)
    })
  }
}
