// F09-T2: the glossary screen. An editor adds a kept term, edits it into a translated one, then deletes it after the
// confirmation; axe on the screen with the form open
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'

test('add, edit and delete a glossary term', async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== 'chromium' || isMobile, 'The glossary runs in desktop Chromium here')
  expect((await page.context().request.post('/api/_test/session?role=editor', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
  await page.goto('/admin/glossario')
  await expect(page.getByRole('heading', { level: 1, name: 'Glossário' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)

  const term = `Borda ${randomBytes(3).toString('hex')}`
  await page.getByLabel('Termo em português').fill(term)
  await page.getByLabel('Manter como está (não traduzir)').check()
  await page.getByRole('button', { name: 'Adicionar termo' }).click()
  await expect(page.getByTestId('glossary-status')).toHaveText(`Termo “${term}” adicionado.`)
  const row = page.getByTestId('glossary-row').filter({ hasText: term })
  await expect(row).toContainText('Mantido como está')
  await expectNoBlockingViolations(page)

  await row.getByRole('button', { name: `Editar o termo ${term}` }).click()
  await page.getByLabel('Manter como está (não traduzir)').uncheck()
  await page.getByLabel('Tradução').fill('Edge')
  await page.getByLabel('Idioma').selectOption('en')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByTestId('glossary-status')).toHaveText(`Termo “${term}” salvo.`)
  await expect(row).toContainText('Edge')
  await expect(row).toContainText('en')

  await row.getByRole('button', { name: `Excluir o termo ${term}` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click()
  await expect(page.getByTestId('glossary-status')).toHaveText(`Termo “${term}” excluído.`)
  await expect(row).toHaveCount(0)
})
