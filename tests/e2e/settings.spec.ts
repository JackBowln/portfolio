// F08-T1: the settings screen. The owner changes the footer text (pt-BR and German), the public site shows it after
// the save (the page's settings tag is purged), and the text is put back; the AI section explains a fresh sign-in.
// axe on the screen
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'The settings screen runs in desktop Chromium here; axe covers it')

const ORIGIN = { origin: SITE_ORIGIN }

test('change the footer → the public site updates', async ({ page }) => {
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  await page.goto('/admin/configuracoes')
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible()
  const footer = page.getByTestId('settings-footer')
  await expect(footer.getByRole('heading', { name: 'Rodapé' })).toBeVisible()
  await expectNoBlockingViolations(page)

  const text = footer.getByRole('textbox', { name: 'Texto do rodapé' })
  const before = await text.inputValue()
  const marker = `Rodapé de teste ${randomBytes(3).toString('hex')}`
  await text.fill(marker)
  await footer.getByLabel('Idioma do texto').selectOption('de')
  await footer.getByRole('button', { name: 'Escrever para este idioma' }).click()
  await footer.getByRole('textbox', { name: 'Texto do rodapé' }).fill(`${marker} (de)`)
  await footer.getByRole('button', { name: 'Salvar Rodapé' }).click()
  await expect(footer.getByText('Configuração salva.')).toBeVisible()

  await page.goto('/sobre')
  await expect(page.getByTestId('footer-text')).toHaveText(marker)
  await page.goto('/de/ueber-mich')
  await expect(page.getByTestId('footer-text')).toHaveText(`${marker} (de)`)
  await page.goto('/fr/a-propos')
  await expect(page.getByTestId('footer-text')).toHaveText(marker)

  // Back as it was
  await page.goto('/admin/configuracoes')
  await footer.getByRole('textbox', { name: 'Texto do rodapé' }).fill(before)
  await footer.getByLabel('Idioma do texto').selectOption('de')
  await footer.getByRole('button', { name: 'Voltar a usar o português neste idioma' }).click()
  await footer.getByRole('button', { name: 'Salvar Rodapé' }).click()
  await expect(footer.getByText('Configuração salva.')).toBeVisible()
})

test('changing the AI section with an old sign-in asks for a new one', async ({ page }) => {
  expect((await page.context().request.post(`/api/_test/session?role=owner&ageSeconds=${20 * 60}`, { headers: ORIGIN })).status()).toBe(200)
  await page.goto('/admin/configuracoes')
  const ai = page.getByTestId('settings-ai_translation')
  await ai.getByLabel('Modelo').fill('teste')
  await ai.getByRole('button', { name: 'Salvar Tradução por IA' }).click()
  await expect(ai.getByText(/entre de novo/)).toBeVisible()
})

test('an editor reads the settings without saving', async ({ page }) => {
  expect((await page.context().request.post('/api/_test/session?role=editor', { headers: ORIGIN })).status()).toBe(200)
  await page.goto('/admin/configuracoes')
  await expect(page.getByText('Você pode ver as configurações; só owner e admin as alteram.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Salvar/ })).toHaveCount(0)
})
