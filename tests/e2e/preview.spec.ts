// F06-T3: from the article editor, a preview link is generated and copied; opened by someone who is not signed in,
// it shows the draft in the article layout under the "Preview" band, follows later saves, and passes axe
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'
import { uniqueName } from '../support/media-api'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'The article editor runs in desktop Chromium here; the preview page is checked by axe in both themes below')

test('a preview link shows the saved draft to someone who is not signed in', async ({ page, browser, context }) => {
  test.setTimeout(90_000)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  expect((await context.request.post('/api/_test/session?role=owner', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
  const title = `Rascunho para revisão ${uniqueName('p', 'x')}`

  await page.goto('/admin/artigos')
  await page.getByRole('textbox', { name: 'Título do novo artigo' }).fill(title)
  await page.getByRole('button', { name: 'Criar e abrir' }).click()
  const body = page.getByRole('textbox', { name: 'Corpo do artigo' })
  await expect(body).toBeVisible()
  await body.click()
  await page.keyboard.type('Primeira versão do texto.')

  // Generating saves what is pending first
  await page.getByLabel('Validade do link').selectOption('1')
  await page.getByRole('button', { name: 'Gerar link de pré-visualização' }).click()
  const url = page.getByTestId('preview-url')
  await expect(url).toHaveValue(/\/preview\/[\w-]+\.[\w-]+$/)
  await page.getByRole('button', { name: 'Copiar link' }).click()
  await expect(page.getByText('Link copiado.')).toBeVisible()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toBe(await url.inputValue())

  // Someone else, not signed in
  const guest = await browser.newContext()
  const preview = await guest.newPage()
  for (const scheme of ['light', 'dark'] as const) {
    await preview.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await preview.goto(link)
    await expect(preview.getByTestId('preview-band')).toContainText('Pré-visualização')
    await expect(preview.getByTestId('preview-band')).toContainText(/BRT|GMT-3/)
    await expect(preview.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(preview.getByText('Primeira versão do texto.')).toBeVisible()
    await expectNoBlockingViolations(preview)
  }

  // The link follows later saves
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill(`${title} revisado`)
  await expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 10_000 })
  await preview.reload()
  await expect(preview.getByRole('heading', { level: 1, name: `${title} revisado` })).toBeVisible()
  await guest.close()
})
