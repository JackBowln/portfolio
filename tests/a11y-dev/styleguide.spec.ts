import { test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'

// Final tokens (F01-T2) in both system themes and with each theme forced by the toggle's stored choice
const cases = [
  { name: 'light system', colorScheme: 'light', stored: undefined },
  { name: 'dark system', colorScheme: 'dark', stored: undefined },
  { name: 'stored dark over a light system', colorScheme: 'light', stored: 'dark' },
  { name: 'stored light over a dark system', colorScheme: 'dark', stored: 'light' },
] as const

for (const { name, colorScheme, stored } of cases) {
  test(`styleguide, ${name}: no serious or critical axe violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    if (stored) {
      await page.addInitScript(theme => localStorage.setItem('theme', theme), stored)
    }
    await page.goto('/dev/styleguide')

    await expectNoBlockingViolations(page)
  })
}
