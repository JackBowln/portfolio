// F05-T4: the rendered document with every node type (test page, real library media) passes axe in both themes,
// with a gallery dialog open too; code tokens keep their Shiki colors, so this checks the themes' contrast as well
import { expect, test } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'
import { contentFixturePath } from '../support/media-api'

let path: string
test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL })
  path = await contentFixturePath(request)
  await request.dispose()
})

for (const theme of ['light', 'dark'] as const) {
  test(`the rendered document has no serious or critical axe violations (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto(path)
    await expect(page.getByRole('button', { name: 'Copiar' })).toBeVisible()
    await expectNoBlockingViolations(page)

    await page.getByRole('button', { name: /Ampliar imagem 1 de 3/ }).click()
    await expect(page.getByRole('dialog', { name: 'Imagem 1 de 3' })).toBeVisible()
    await expectNoBlockingViolations(page)
  })
}
