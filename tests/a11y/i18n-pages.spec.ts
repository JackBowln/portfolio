import { test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'
import { ensureBlogFixture } from '../support/blog'

test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL })
  await ensureBlogFixture(request)
  await request.dispose()
})

for (const path of ['/sobre', '/en/about', '/de/blog/x']) {
  test(`${path} has no serious or critical axe violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(path)

    await expectNoBlockingViolations(page)
  })
}
