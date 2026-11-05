// F07-T1: projects in the admin. A new project opens with the case-study sections and the "verifiable results only"
// note; the fields save themselves (an http: link is refused on the spot), a result is added, a technology created
// on the spot is ticked, and the project is published by hand (no schedule). The list keeps a manual order changed
// with buttons; technologies have their own screen. axe on the editor and the list
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'The project editor runs in desktop Chromium here; axe covers the screens')

const ORIGIN = { origin: SITE_ORIGIN }
const unique = () => randomBytes(3).toString('hex')

async function signIn(page: Page, role = 'owner') {
  expect((await page.context().request.post(`/api/_test/session?role=${role}`, { headers: ORIGIN })).status()).toBe(200)
}

const autosaved = (page: Page) => expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 10_000 })

test('create, fill the case study, add a result and a technology, and publish', async ({ page }) => {
  await signIn(page)
  const suffix = unique()
  await page.goto('/admin/projetos')
  await page.getByRole('textbox', { name: 'Título do novo projeto' }).fill(`Portal de dados ${suffix}`)
  await page.getByRole('button', { name: 'Criar e abrir' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Portal de dados ${suffix}` })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Endereço (slug)' })).toHaveValue(`portal-de-dados-${suffix}`)
  // The case-study sections are in the body, and the results come with the warning
  const body = page.getByRole('textbox', { name: 'Narrativa' })
  for (const section of ['Contexto', 'Desafio', 'Solução', 'Resultados']) {
    await expect(body.getByRole('heading', { level: 2, name: section })).toBeVisible()
  }
  await expect(page.getByTestId('highlights-warning')).toHaveText(/Use apenas resultados verificáveis/)
  await expectNoBlockingViolations(page)

  await page.getByLabel('Resumo').fill('Painel público de indicadores.')
  await page.getByLabel('Papel').fill('Desenvolvedor front-end')
  await page.getByLabel('Início').fill('2024-03')
  await page.getByLabel('Link do GitHub').fill('http://github.com/exemplo/portal')
  await expect(page.getByText('Use um link que comece com https://.')).toBeVisible({ timeout: 10_000 })
  await page.getByLabel('Link do GitHub').fill('https://github.com/exemplo/portal')
  await autosaved(page)

  await page.getByRole('button', { name: 'Adicionar resultado' }).click()
  await page.getByLabel('Rótulo do resultado 1').fill('Tempo de carregamento')
  await page.getByLabel('Valor do resultado 1').fill('-35%')
  await page.getByLabel('Como foi medido (resultado 1)').fill('[PLACEHOLDER] Lighthouse antes e depois')
  const technology = `Vue ${suffix}`
  await page.getByLabel('Criar tecnologia').fill(technology)
  await page.getByRole('button', { name: 'Criar e marcar' }).click()
  await expect(page.getByRole('checkbox', { name: technology })).toBeChecked()
  await autosaved(page)

  // Published by hand: no schedule for projects
  await expect(page.getByRole('button', { name: 'Agendar' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Publicar agora' }).click()
  // F11-T2: publishing draws and uploads the share image first
  await expect(page.getByText('Projeto publicado.')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('publish-status')).toContainText('No site desde')

  // Reloaded, everything was saved
  await page.reload()
  await expect(page.getByLabel('Valor do resultado 1')).toHaveValue('-35%')
  await expect(page.getByLabel('Link do GitHub')).toHaveValue('https://github.com/exemplo/portal')
  await expect(page.getByLabel('Início')).toHaveValue('2024-03')
  await expect(page.getByRole('checkbox', { name: technology })).toBeChecked()
})

test('the list keeps a manual order, changed with buttons', async ({ page }) => {
  await signIn(page)
  const request = page.context().request
  const titles = [`Primeiro ${unique()}`, `Segundo ${unique()}`]
  for (const title of titles) {
    expect((await request.post('/api/admin/projects', { headers: ORIGIN, data: { title } })).status()).toBe(201)
  }
  await page.goto('/admin/projetos')
  const rows = page.getByTestId('project-row')
  const positionOf = async (title: string) => (await rows.allTextContents()).findIndex(text => text.includes(title))
  await expect(rows.filter({ hasText: titles[1]! })).toBeVisible()
  const before = await positionOf(titles[1]!)
  expect(before).toBeGreaterThan(0)
  await page.getByRole('button', { name: `Subir “${titles[1]}”` }).click()
  await expect(page.getByText(`“${titles[1]}” agora está na posição ${before}.`)).toBeVisible()
  expect(await positionOf(titles[1]!)).toBe(before - 1)
  await page.reload()
  await expect(rows.filter({ hasText: titles[1]! })).toBeVisible()
  expect(await positionOf(titles[1]!)).toBe(before - 1)
  await expectNoBlockingViolations(page)
})

test('an author sees no reorder buttons; technologies have their own screen', async ({ page }) => {
  await signIn(page, 'author')
  await page.goto('/admin/projetos')
  await expect(page.getByRole('heading', { level: 1, name: 'Projetos' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Subir/ })).toHaveCount(0)

  await signIn(page, 'editor')
  await page.goto('/admin/tecnologias')
  const name = `TypeScript ${unique()}`
  await page.getByRole('textbox', { name: 'Nome da tecnologia' }).fill(name)
  await page.getByRole('button', { name: 'Adicionar tecnologia' }).click()
  await expect(page.getByRole('rowheader', { name })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Projetos' })).toBeVisible()
})
