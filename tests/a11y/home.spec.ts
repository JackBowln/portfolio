import { test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'

for (const colorScheme of ['light', 'dark'] as const) {
  test(`home has no serious or critical axe violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.goto('/')

    await expectNoBlockingViolations(page)
  })
}
