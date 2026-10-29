// F01-T5 and the F01 gate: the public frame has no serious or critical axe violations at 360, 768 and 1280 px,
// in pt-BR and de, in both themes; also with the mobile menu open and on the 404 page
import { expect, test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'

const PAGES = ['/', '/sobre', '/de/ueber-mich', '/de/blog/x', '/does-not-exist', '/de/does-not-exist']
const WIDTHS = [360, 768, 1280]

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of WIDTHS) {
    for (const path of PAGES) {
      test(`${path} at ${width} px (${colorScheme})`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
        await page.goto(path)
        await page.waitForLoadState('networkidle')

        await expectNoBlockingViolations(page)
      })
    }
  }

  for (const path of ['/', '/de']) {
    test(`${path} with the mobile menu open (${colorScheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: /^(Menu|Menü)$/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await expectNoBlockingViolations(page)
    })
  }
}
