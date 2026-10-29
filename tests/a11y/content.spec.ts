// F05-T4: the rendered document with every node type (test page, real library media) passes axe in both themes,
// with a gallery dialog open too; code tokens keep their Shiki colors, so this checks the themes' contrast as well
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'
import { readyImage, readyVideo, uniqueName } from '../support/media-api'

let path: string
test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL })
  expect((await request.post('/api/_test/session?role=owner', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
  const poster = await readyImage(request, uniqueName('capa', 'jpg'))
  const ids = {
    photo: await readyImage(request, uniqueName('foto', 'jpg')),
    second: await readyImage(request, uniqueName('segunda', 'jpg')),
    third: await readyImage(request, uniqueName('terceira', 'jpg')),
    clip: await readyVideo(request, uniqueName('clipe', 'mp4'), poster),
    poster,
  }
  path = `/_test/content?${new URLSearchParams(ids)}`
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
