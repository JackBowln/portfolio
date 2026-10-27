// F01-T2: a theme forced by the toggle (data-theme) passes axe like the system themes in home.spec.ts
import { test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'

for (const [stored, system] of [['dark', 'light'], ['light', 'dark']] as const) {
  test(`home with a stored ${stored} theme over a ${system} system has no serious or critical axe violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: system, reducedMotion: 'reduce' })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), stored)
    await page.goto('/')

    await expectNoBlockingViolations(page)
  })
}
