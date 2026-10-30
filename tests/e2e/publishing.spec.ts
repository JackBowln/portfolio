// F06-T4 (part of J-04; the public page, RSS and sitemap come with F06-T5): publishing from the article screen.
// Publish, see unpublished changes, publish them with a new slug (the old path answers 301), schedule in the site's
// time zone, let the cron run with a moved clock, cancel a schedule, unpublish, and the reason a publish is refused
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { utcToZoned } from '../../shared/utils/time-zone'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'
import { readyImage, uniqueName } from '../support/media-api'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'The article editor runs in desktop Chromium here; axe covers the panel')

const ORIGIN = { origin: SITE_ORIGIN }

async function openNew(page: Page, title: string) {
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  await page.goto('/admin/artigos')
  await page.getByRole('textbox', { name: 'Título do novo artigo' }).fill(title)
  await page.getByRole('button', { name: 'Criar e abrir' }).click()
  await expect(page.getByRole('textbox', { name: 'Corpo do artigo' })).toBeVisible()
  return page.url().split('/').at(-1)!
}

test('publish, publish changes with a new slug, and unpublish', async ({ page }) => {
  await openNew(page, `Publicar pela tela ${uniqueName('p', 'x')}`)
  const status = page.getByTestId('publish-status')
  await expect(status).toHaveText('Rascunho: ainda não está no site.')
  await expectNoBlockingViolations(page)
  await page.getByRole('button', { name: 'Publicar agora' }).click()
  await expect(page.getByText('Artigo publicado.')).toBeVisible()
  await expect(status).toContainText('No site desde')
  const oldSlug = await page.getByRole('textbox', { name: 'Endereço (slug)' }).inputValue()

  await page.getByRole('textbox', { name: 'Endereço (slug)' }).fill(`${oldSlug}-v2`)
  await expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 10_000 })
  await expect(page.getByText('Há alterações salvas que ainda não estão no site.')).toBeVisible()
  await page.getByRole('button', { name: 'Publicar alterações' }).click()
  await expect(page.getByText('Artigo publicado.')).toBeVisible()
  await expect(page.getByText('Há alterações salvas que ainda não estão no site.')).toBeHidden()
  const redirect = await page.context().request.get(`/blog/${oldSlug}`, { maxRedirects: 0 })
  expect(redirect.status()).toBe(301)
  expect(redirect.headers().location).toBe(`/blog/${oldSlug}-v2`)

  await page.getByRole('button', { name: 'Despublicar' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Tirar este artigo do site?' })
  await expectNoBlockingViolations(page)
  await confirm.getByRole('button', { name: 'Despublicar' }).click()
  await expect(status).toHaveText('Fora do site (despublicado).')
})

test('schedule in the site time zone, the cron publishes after the time, and a schedule can be cancelled', async ({ page }) => {
  const id = await openNew(page, `Agendar pela tela ${uniqueName('a', 'x')}`)
  const at = new Date(Date.now() + 2 * 3600_000)
  at.setSeconds(0, 0)
  await page.getByLabel('Data e hora (America/Sao_Paulo)').fill(utcToZoned(at))
  await page.getByRole('button', { name: 'Agendar' }).click()
  const status = page.getByTestId('publish-status')
  await expect(status).toContainText('Agendado para')
  expect((await (await page.context().request.get(`/api/admin/articles/${id}`)).json()).localizations[0].scheduledAt).toBe(at.toISOString())

  // The cron, four minutes after the time
  const run = await page.context().request.post('/api/_test/run-task', { headers: ORIGIN, data: { now: new Date(at.getTime() + 4 * 60_000).toISOString(), articleIds: [id] } })
  expect((await run.json()).published).toBe(1)
  await page.reload()
  await expect(page.getByTestId('publish-status')).toContainText('No site desde')

  const other = await openNew(page, `Cancelar agendamento ${uniqueName('c', 'x')}`)
  await page.getByLabel('Data e hora (America/Sao_Paulo)').fill(utcToZoned(at))
  await page.getByRole('button', { name: 'Agendar' }).click()
  await expect(page.getByTestId('publish-status')).toContainText('Agendado para')
  await page.getByRole('button', { name: 'Cancelar agendamento' }).click()
  await expect(page.getByTestId('publish-status')).toHaveText('Rascunho: ainda não está no site.')
  expect((await (await page.context().request.get(`/api/admin/articles/${other}`)).json()).localizations[0].status).toBe('draft')
})

test('an image without alt text blocks publishing, with the reason', async ({ page }) => {
  const id = await openNew(page, `Sem texto alternativo ${uniqueName('s', 'x')}`)
  const request = page.context().request
  const cover = await readyImage(request, uniqueName('capa', 'jpg'))
  const current = await (await request.get(`/api/admin/articles/${id}`)).json()
  expect((await request.patch(`/api/admin/articles/${id}`, { headers: ORIGIN, data: { version: current.localizations[0].version, coverMediaId: cover } })).status()).toBe(200)
  await page.reload()
  await page.getByRole('button', { name: 'Publicar agora' }).click()
  await expect(page.getByText(/1 imagem precisa de texto alternativo antes de publicar/)).toBeVisible()
  await expect(page.getByTestId('publish-status')).toHaveText('Rascunho: ainda não está no site.')
})
