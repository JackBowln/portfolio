// J-03 (PRD §8): the owner creates an article, puts in an image and code, previews it and schedules it. The image
// goes through the browser pipeline (a photo the browser renders, so no binary lives in the repository) and is
// picked from the library in the editor; the code is highlighted in the browser; the preview link opens for someone
// signed out; the schedule is kept in the site's time zone. Desktop Chromium and a phone (WebKit)
import { expect, test } from '@playwright/test'
import { utcToZoned } from '../../../shared/utils/time-zone'
import { hydrated, ORIGIN, signInAsOwner, unique } from '../../support/journeys'
import { photo } from '../../support/photo'

test('J-03: create, insert an image and code, preview, schedule', async ({ page, browser }) => {
  test.setTimeout(240_000)
  const request = page.context().request
  await signInAsOwner(request)

  // An image through the pipeline, with its alt
  const name = `j03-${unique()}.jpg`
  await page.goto('/admin/midia')
  await hydrated(page)
  await page.getByLabel('Escolher imagem').setInputFiles({ name, mimeType: 'image/jpeg', buffer: await photo(browser, 1200, 800) })
  await expect(page.getByRole('status').filter({ hasText: `Imagem enviada: ${name}` })).toBeVisible({ timeout: 150_000 })
  const mediaId = await page.getByTestId('media-row').filter({ hasText: name }).getAttribute('data-media-id')
  expect((await request.patch(`/api/admin/media/${mediaId}`, { headers: ORIGIN, data: { localizations: { 'pt-BR': { alt: 'Uma foto do teste J-03' } } } })).status()).toBe(200)

  // The article, with text, the image and a code block
  const title = `Jornada J-03 ${unique()}`
  await page.goto('/admin/artigos')
  await hydrated(page)
  await page.getByRole('textbox', { name: 'Título do novo artigo' }).fill(title)
  await page.getByRole('button', { name: 'Criar e abrir' }).click()
  const body = page.getByRole('textbox', { name: 'Corpo do artigo' })
  await expect(body).toBeVisible()
  await body.click()
  await page.keyboard.type('Um parágrafo antes da imagem.')
  const toolbar = page.getByRole('toolbar', { name: 'Formatação e blocos' })
  await toolbar.getByRole('button', { name: 'Imagem', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Escolher da biblioteca' })
  await picker.getByRole('searchbox').fill(name)
  await picker.getByRole('searchbox').press('Enter')
  await picker.getByRole('button', { name: `Escolher ${name}` }).click()
  await expect(picker).toBeHidden()
  await toolbar.getByRole('button', { name: 'Bloco de código', exact: true }).click()
  const code = page.locator('[data-node-view="codeBlock"]')
  await code.getByLabel('Linguagem').selectOption('ts')
  await code.getByLabel('Código').fill('const answer: number = 42')
  await expect(code.getByRole('group', { name: 'Pré-visualização do destaque' }).locator('pre.shiki span[style]').first()).toBeVisible()
  await page.getByRole('button', { name: 'Salvar agora' }).click()
  await expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 15_000 })

  // The preview, for someone signed out
  await page.getByLabel('Validade do link').selectOption('1')
  await page.getByRole('button', { name: 'Gerar link de pré-visualização' }).click()
  const link = await page.getByTestId('preview-url').inputValue()
  expect(link).toMatch(/\/preview\/[\w-]+\.[\w-]+$/)
  const guest = await browser.newContext()
  const preview = await guest.newPage()
  await preview.goto(link)
  await expect(preview.getByTestId('preview-band')).toContainText('Pré-visualização')
  await expect(preview.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expect(preview.getByRole('img', { name: 'Uma foto do teste J-03' })).toBeVisible()
  await expect(preview.locator('pre.shiki')).toContainText('const answer: number = 42')
  await guest.close()

  // Scheduled for tomorrow at 9:00 in the site's time zone
  const at = new Date(Date.now() + 24 * 3600_000)
  at.setUTCSeconds(0, 0)
  await page.getByLabel('Data e hora (America/Sao_Paulo)').fill(utcToZoned(at))
  await page.getByRole('button', { name: 'Agendar' }).click()
  // Scheduling makes the share image first (F11-T2)
  await expect(page.getByTestId('publish-status')).toContainText('Agendado para', { timeout: 60_000 })
  const id = page.url().split('/').at(-1)!
  expect((await (await request.get(`/api/admin/articles/${id}`)).json()).localizations[0]).toMatchObject({ status: 'scheduled', scheduledAt: at.toISOString() })
})
