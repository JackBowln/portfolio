// J-07 (PRD §8; F06-T2, F12-T1): the owner edits an article, saves a named version, edits again, compares in the history and
// restores the earlier version; the restore is a new revision and nothing is deleted. Desktop Chromium and a phone (WebKit)
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../../support/auth'
import { uniqueName } from '../../support/media-api'

test('J-07: edit, save a version, edit again, compare and restore the earlier version', async ({ page }) => {
  test.setTimeout(90_000)
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
  const status = page.getByTestId('autosave-status')
  const title = page.getByRole('textbox', { name: 'Título', exact: true })
  const body = page.getByRole('textbox', { name: 'Corpo do artigo' })
  const first = `Primeira versão ${uniqueName('h', 'x')}`
  const second = `Título reescrito ${uniqueName('r', 'x')}`

  await page.goto('/admin/artigos')
  await page.getByRole('textbox', { name: 'Título do novo artigo' }).fill(first)
  await page.getByRole('button', { name: 'Criar e abrir' }).click()
  await expect(body).toBeVisible()
  await body.click()
  await page.keyboard.type('O texto original do artigo.')
  await expect(status).toContainText(/Salvo às/, { timeout: 10_000 })

  // A named version
  await page.getByRole('button', { name: 'Salvar versão' }).first().click()
  const versionDialog = page.getByRole('dialog', { name: 'Salvar uma versão' })
  await versionDialog.getByLabel('Nota (opcional)').fill('Antes da revisão')
  await versionDialog.getByRole('button', { name: 'Salvar versão' }).click()
  await expect(page.getByText(/Versão \d+ salva\./)).toBeVisible()

  // Edit again
  await title.fill(second)
  await body.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Um texto completamente diferente.')
  // "Save now" waits for every pending save, so the history below is complete
  await page.getByRole('button', { name: 'Salvar agora' }).click()
  await expect(status).toContainText(/Salvo às/, { timeout: 10_000 })

  // The history lists the named version; comparing shows what changed since
  await page.getByText('Mostrar histórico').click()
  const history = page.getByTestId('history-list')
  const named = history.getByRole('listitem').filter({ hasText: 'Antes da revisão' })
  await expect(named).toContainText('versão salva')
  await named.getByRole('button', { name: /^Comparar/ }).click()
  const diff = page.getByTestId('revision-diff')
  await expect(diff).toContainText(first)
  await expect(diff).toContainText(second)
  await expect(diff).toContainText('completamente diferente')
  const before = await history.getByRole('listitem').count()

  // Restore it
  await named.getByRole('button', { name: /^Restaurar/ }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Nenhuma versão é apagada')
  await confirm.getByRole('button', { name: 'Restaurar' }).click()
  await expect(page.getByText(/Versão \d+ restaurada\./)).toBeVisible()
  await expect(title).toHaveValue(first)
  await expect(body).toContainText('O texto original do artigo.')
  await expect(history.getByRole('listitem').first()).toContainText('restauração')
  // Nothing was deleted: the named version is still there, and the list only grew
  await expect(named).toBeVisible()
  expect(await history.getByRole('listitem').count()).toBeGreaterThan(before)

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(first)
  await expect(page.getByRole('textbox', { name: 'Corpo do artigo' })).toContainText('O texto original do artigo.')
})
