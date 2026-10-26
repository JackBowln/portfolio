import { test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'

// Both type pairings × both palettes × both themes (F01-T1)
const variants = ['a', 'b'].flatMap(type => ['a', 'b'].flatMap(palette => ['light', 'dark'].map(theme => ({ type, palette, theme }))))

for (const { type, palette, theme } of variants) {
  test(`styleguide type ${type}, palette ${palette}, ${theme}: no serious or critical axe violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/dev/styleguide?type=${type}&palette=${palette}&theme=${theme}`)

    await expectNoBlockingViolations(page)
  })
}
