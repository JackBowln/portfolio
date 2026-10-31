// F08-T2: institutional pages in the admin and on the site. Edit the home's hero, publish, the public home shows it
// (then the hero is put back); the German about page shows the pt-BR content with the notice. axe on the editor
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'
import { ensureBlogFixture } from '../support/blog'

const ORIGIN = { origin: SITE_ORIGIN }

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('edit the home hero → publish → the public home shows it', async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== 'chromium' || isMobile, 'The page editor runs in desktop Chromium here')
  expect((await page.context().request.post('/api/_test/session?role=editor', { headers: ORIGIN })).status()).toBe(200)
  await page.goto('/admin/paginas')
  await page.getByRole('link', { name: 'Início' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
  await expectNoBlockingViolations(page)

  const title = page.getByLabel('Título', { exact: true })
  const before = await title.inputValue()
  const marker = `Título publicado ${randomBytes(3).toString('hex')}`
  await title.fill(marker)
  await expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 10_000 })
  await page.getByRole('button', { name: /^Publicar/ }).click()
  await expect(page.getByText('Página publicada.')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(marker)

  // Back as it was
  await page.goto('/admin/paginas/home')
  await page.getByLabel('Título', { exact: true }).fill(before)
  await expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 10_000 })
  await page.getByRole('button', { name: /^Publicar/ }).click()
  await expect(page.getByText('Página publicada.')).toBeVisible()
})

test('the German about page shows the pt-BR content with the notice', async ({ page }) => {
  await page.goto('/de/ueber-mich')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('note')).toHaveText('Diese Seite wurde noch nicht übersetzt; der Inhalt unten ist auf Portugiesisch.')
  await expect(page.getByText('[PLACEHOLDER] Texto de exemplo do artigo de teste.')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
})
