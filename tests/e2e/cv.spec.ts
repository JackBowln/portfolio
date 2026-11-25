// F13-T5 (ADR-0017): the CV end to end. The owner uploads a PDF in the identity settings, saves, and the public site
// offers "Baixar CV" with a download (attachment, sandboxed, one day); removing it takes the link away again.
// The PDF is generated here, not the owner's CV, so no personal file enters the test suite
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'The CV upload runs in desktop Chromium, like the media pipeline')

const ORIGIN = { origin: SITE_ORIGIN }

// A minimal, valid-looking PDF: the header is what the server checks; the body is a one-page document
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')

test('the CV is uploaded in the settings, offered on the site, and removed again', async ({ page }) => {
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  await page.goto('/admin/configuracoes')

  const identity = page.getByTestId('settings-identity')
  await expect(identity.getByRole('heading', { name: 'Identidade' })).toBeVisible()
  await identity.getByLabel('Currículo (PDF)').setInputFiles({ name: 'cv-teste.pdf', mimeType: 'application/pdf', buffer: PDF })
  await expect(identity.getByText('cv-teste.pdf')).toBeVisible({ timeout: 60_000 })
  await identity.getByRole('button', { name: 'Salvar Identidade' }).click()
  await expect(identity.getByText('Configuração salva.')).toBeVisible()

  await page.goto('/')
  const link = page.getByRole('link', { name: 'Baixar CV' }).first()
  await expect(link).toBeVisible()
  const href = await link.getAttribute('href')
  expect(href).toMatch(/\/media\/[0-9a-f]{2}\/[0-9a-f]{64}\/file\.pdf$/)

  const served = await page.request.get(href!)
  expect(served.status()).toBe(200)
  expect(served.headers()['content-type']).toBe('application/pdf')
  expect(served.headers()['content-disposition']).toBe('attachment; filename="cv.pdf"')
  expect(served.headers()['content-security-policy']).toBe('default-src \'none\'; sandbox')
  expect(served.headers()['cache-control']).toBe('public, max-age=86400')
  expect((await served.body()).subarray(0, 5).toString()).toBe('%PDF-')

  // Back as it was: the link goes away with the CV
  await page.goto('/admin/configuracoes')
  await identity.getByRole('button', { name: 'Remover currículo' }).click()
  await identity.getByRole('button', { name: 'Salvar Identidade' }).click()
  await expect(identity.getByText('Configuração salva.')).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Baixar CV' })).toHaveCount(0)
})
