// F06-T1 (+ F06-T2): creating and editing an article in the admin (desktop Chromium, like the editor E2E). A new
// article opens from its title; the slug follows the title until edited; body, excerpt, cover, a topic created on
// the spot and SEO save themselves (autosave) and survive a reload, with the search-result warnings on the way; a
// taken slug pauses autosave on the field, and a save from another tab opens the conflict dialog, whose two choices
// both work without losing anything silently
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'
import { readyImage, uniqueName } from '../support/media-api'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'The article editor runs in desktop Chromium here; axe covers the rest')

const ORIGIN = { origin: SITE_ORIGIN }

async function signIn(page: Page) {
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
}

const autosaved = (page: Page) => expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 10_000 })

async function openNew(page: Page, title: string) {
  await page.goto('/admin/artigos')
  await page.getByRole('textbox', { name: 'Título do novo artigo' }).fill(title)
  await page.getByRole('button', { name: 'Criar e abrir' }).click()
  await expect(page).toHaveURL(/\/admin\/artigos\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('textbox', { name: 'Corpo do artigo' })).toBeVisible()
}

test('an article is created, edited and saved, and the changes survive a reload', async ({ page }) => {
  test.setTimeout(90_000)
  await signIn(page)
  const suffix = uniqueName('x', 'y').slice(2, 8)
  const coverName = uniqueName('capa', 'jpg')
  await readyImage(page.context().request, coverName)

  await openNew(page, `Guia de acessibilidade ${suffix}`)
  // Opening a document is not an unsaved change
  await expect(page.getByTestId('autosave-status')).toHaveText('Salvamento automático ligado.')
  const slug = page.getByRole('textbox', { name: 'Endereço (slug)' })
  await expect(slug).toHaveValue(`guia-de-acessibilidade-${suffix}`)

  // The slug follows the title until it is edited by hand
  const title = page.getByRole('textbox', { name: 'Título', exact: true })
  await title.fill(`Guia prático de acessibilidade ${suffix}`)
  await expect(slug).toHaveValue(`guia-pratico-de-acessibilidade-${suffix}`)
  await slug.fill(`guia-a11y-${suffix}`)
  await title.fill(`Guia prático de acessibilidade web ${suffix}`)
  await expect(slug).toHaveValue(`guia-a11y-${suffix}`)
  await expect(page.getByRole('button', { name: 'Gerar do título' })).toBeVisible()

  await page.getByLabel('Resumo').fill('Como tornar um site navegável por teclado.')
  const body = page.getByRole('textbox', { name: 'Corpo do artigo' })
  await body.click()
  await page.keyboard.type('Comece pelo teclado e pelo foco visível.')
  await autosaved(page)

  // Cover from the library
  await page.getByRole('button', { name: 'Escolher capa' }).click()
  const picker = page.getByRole('dialog', { name: 'Escolher da biblioteca' })
  await picker.getByRole('searchbox').fill(coverName)
  await picker.getByRole('searchbox').press('Enter')
  await picker.getByRole('button', { name: `Escolher ${coverName}` }).click()
  await expect(page.getByRole('group', { name: 'Capa', exact: true }).getByRole('paragraph').filter({ hasText: coverName })).toBeVisible()

  // A topic created on the spot is ticked at once
  const topicName = `Teclado ${suffix}`
  await page.getByLabel('Criar tema').fill(topicName)
  await page.getByRole('button', { name: 'Criar e marcar' }).click()
  await expect(page.getByRole('checkbox', { name: topicName })).toBeChecked()

  // Search-result guidance
  const serp = page.getByTestId('serp-preview')
  await expect(serp).toContainText(`guia-a11y-${suffix}`)
  await expect(page.getByText(/A descrição tem menos de 120 caracteres/)).toBeVisible()
  await page.getByLabel('Título SEO').fill('Um título muito longo que certamente passa do limite recomendado para buscadores')
  await expect(page.getByText(/O título passa de 60 caracteres/)).toBeVisible()
  await page.getByLabel('Título SEO').fill('')

  await autosaved(page)

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Corpo do artigo' })).toContainText('Comece pelo teclado e pelo foco visível.')
  await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(`Guia prático de acessibilidade web ${suffix}`)
  await expect(page.getByRole('textbox', { name: 'Endereço (slug)' })).toHaveValue(`guia-a11y-${suffix}`)
  await expect(page.getByLabel('Resumo')).toHaveValue('Como tornar um site navegável por teclado.')
  await expect(page.getByRole('checkbox', { name: topicName })).toBeChecked()
  await expect(page.getByRole('group', { name: 'Capa', exact: true }).getByRole('paragraph').filter({ hasText: coverName })).toBeVisible()

  // Listed with its status
  await page.getByRole('link', { name: 'Voltar para os artigos' }).click()
  const row = page.getByTestId('article-row').filter({ hasText: `Guia prático de acessibilidade web ${suffix}` })
  await expect(row).toContainText('Rascunho')
})

test('a taken slug pauses autosave on the field until it is fixed', async ({ page }) => {
  await signIn(page)
  const taken = await (await page.context().request.post('/api/admin/articles', { headers: ORIGIN, data: { title: `Ocupado ${uniqueName('s', 'x')}` } })).json()
  await openNew(page, `Endereço ${uniqueName('c', 'x')}`)
  const slug = page.getByRole('textbox', { name: 'Endereço (slug)' })
  await slug.fill(taken.localizations[0].slug)
  await expect(page.getByText('Já existe um artigo com este endereço. Escolha outro.')).toBeVisible({ timeout: 10_000 })
  await expect(slug).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByTestId('autosave-status')).toHaveText('Corrija os campos marcados antes de salvar.')
  // Back to the saved slug: nothing left to save, and the field is no longer marked
  await page.getByRole('button', { name: 'Gerar do título' }).click()
  await expect(page.getByTestId('autosave-status')).toHaveText('Salvamento automático ligado.')
  await expect(slug).not.toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill(`Endereço livre ${uniqueName('l', 'x')}`)
  await autosaved(page)
})

for (const choice of ['Manter a desta aba', 'Usar a versão salva'] as const) {
  test(`a save from another tab opens the conflict dialog: ${choice}`, async ({ page }) => {
    await signIn(page)
    const request = page.context().request
    await openNew(page, `Conflito ${uniqueName('c', 'x')}`)
    const id = page.url().split('/').at(-1)!
    // Another tab saves first
    const current = await (await request.get(`/api/admin/articles/${id}`)).json()
    expect((await request.patch(`/api/admin/articles/${id}`, { headers: ORIGIN, data: { version: current.localizations[0].version, excerpt: 'De outra aba' } })).status()).toBe(200)

    await page.getByLabel('Resumo').fill('Desta aba')
    const dialog = page.getByRole('alertdialog', { name: 'O artigo foi salvo em outro lugar' })
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('autosave-status')).toHaveText('Salvamento automático pausado.')
    // The diff goes from the saved version to this tab's
    await expect(dialog.getByTestId('revision-diff')).toContainText('De outra aba')
    await expect(dialog.getByTestId('revision-diff')).toContainText('Desta aba')
    await expectNoBlockingViolations(page)
    // Escape does not dismiss it: a choice is required
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: choice }).click()
    await expect(dialog).toBeHidden()
    const expected = choice === 'Manter a desta aba' ? 'Desta aba' : 'De outra aba'
    await expect(page.getByLabel('Resumo')).toHaveValue(expected)
    if (choice === 'Manter a desta aba') {
      await autosaved(page)
    }
    await page.reload()
    await expect(page.getByLabel('Resumo')).toHaveValue(expected)
  })
}
