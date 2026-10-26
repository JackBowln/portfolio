import { test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'

for (const path of ['/sobre', '/en/about', '/de/blog/x']) {
  test(`${path} has no serious or critical axe violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(path)

    await expectNoBlockingViolations(page)
  })
}
