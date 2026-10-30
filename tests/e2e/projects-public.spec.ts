// F07-T2: the public projects in a browser. List → technology filter → case study → the external link with the right
// rel; the filter works without JS; another language from a project only in pt-BR leads to the projects there
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { ensureBlogFixture } from '../support/blog'

const ORIGIN = { origin: SITE_ORIGIN }

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('list → filter → case study → external link', async ({ page }) => {
  await page.goto('/projetos')
  await expect(page.getByRole('heading', { level: 1, name: 'Projetos' })).toBeVisible()
  const filter = page.getByRole('navigation', { name: 'Filtrar por tecnologia' })
  await expect(filter.getByRole('link', { name: 'Todos' })).toHaveAttribute('aria-current', 'page')
  await filter.getByRole('link', { name: /^Tecnologia X/ }).click()
  await expect(page).toHaveURL(/\/projetos\?tech=tecnologia-x$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Projetos com Tecnologia X' })).toBeVisible()
  await expect(filter.getByRole('link', { name: /^Tecnologia X/ })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('link', { name: 'Projeto de exemplo [PLACEHOLDER]' }).click()
  await expect(page).toHaveURL(/\/projetos\/x$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Projeto de exemplo [PLACEHOLDER]' })).toBeVisible()
  const details = page.getByRole('region', { name: 'Ficha do projeto' })
  await expect(details).toContainText('janeiro – junho de 2024')
  await expect(details.getByRole('link', { name: 'Tecnologia X' })).toHaveAttribute('href', '/projetos?tech=tecnologia-x')
  const repo = details.getByRole('link', { name: 'Código no GitHub (site externo)' })
  await expect(repo).toHaveAttribute('href', 'https://example.com/repo')
  await expect(repo).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(page.getByRole('region', { name: 'Resultados' })).toContainText('[PLACEHOLDER] Resultado')

  await page.getByRole('link', { name: 'Deutsch' }).click()
  await expect(page).toHaveURL(/\/de\/projekte\/x$/)
  await expect(page.getByRole('region', { name: 'Projektdetails' })).toContainText('Januar–Juni 2024')
})

test('a project only in pt-BR: the switcher leads to the projects of the other locale', async ({ page }) => {
  const request = page.context().request
  expect((await request.post('/api/_test/session?role=editor', { headers: ORIGIN })).status()).toBe(200)
  const title = `Só em português ${randomBytes(3).toString('hex')}`
  const created = await (await request.post('/api/admin/projects', { headers: ORIGIN, data: { title } })).json() as { id: string, localizations: { slug: string }[] }
  expect((await request.post(`/api/admin/projects/${created.id}/publish`, { headers: ORIGIN, data: { locale: 'pt-BR', version: 1 } })).status()).toBe(200)
  await page.goto(`/projetos/${created.localizations[0]!.slug}`)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/projects')
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('the filter and the case study work', async ({ page }) => {
    await page.goto('/projetos')
    await page.getByRole('navigation', { name: 'Filtrar por tecnologia' }).getByRole('link', { name: /^Tecnologia X/ }).click()
    await expect(page).toHaveURL(/\?tech=tecnologia-x$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Projetos com Tecnologia X' })).toBeVisible()
    await page.goto('/projetos/x')
    await expect(page.getByText('[PLACEHOLDER] Texto de exemplo do artigo de teste.')).toBeVisible()
  })
})
