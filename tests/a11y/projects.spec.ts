// F07-T2: the projects list (with the filter) and a case study pass axe in both themes
import { expect, test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'
import { ensureBlogFixture } from '../support/blog'

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

for (const theme of ['light', 'dark'] as const) {
  for (const path of ['/projetos', '/projetos?tech=tecnologia-x', '/projetos/x', '/de/projekte/x']) {
    test(`${path} has no serious or critical axe violations (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoBlockingViolations(page)
    })
  }
}
