// F06-T5: the blog list, an article (table of contents, topics, related) and a topic page pass axe in both themes
import { expect, test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'
import { ensureBlogFixture } from '../support/blog'

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

for (const theme of ['light', 'dark'] as const) {
  for (const path of ['/blog', '/blog/x', '/de/blog/themen/x']) {
    test(`${path} has no serious or critical axe violations (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoBlockingViolations(page)
    })
  }
}
