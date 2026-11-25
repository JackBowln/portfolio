// F13-T2: the home's stats strip, end to end. The owner enters figures in the home editor, publishes, and the public
// home shows them with their final values; a plain number counts up once, a range stays as written. The figures are
// the ones the owner's CV supports (plan §8.2); the spec removes them again so the site is left as it was
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'The page editor runs in desktop Chromium, like the other admin specs')

const ORIGIN = { origin: SITE_ORIGIN }
const FIGURES = [
  { value: '6+', label: 'Anos de experiência' },
  { value: '~5M', label: 'Usuários na plataforma' },
  { value: '70–80%', label: 'Carregamento mais rápido' },
  { value: '90%+', label: 'Cobertura de componentes críticos' },
]

test('the stats strip shows what the owner enters, and leaves nothing behind', async ({ page }) => {
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  await page.goto('/admin/paginas/home')

  const numbers = page.getByRole('group', { name: 'Números' })
  for (const [index, figure] of FIGURES.entries()) {
    await page.getByRole('button', { name: 'Adicionar número' }).click()
    await page.getByLabel(`Número ${index + 1}`, { exact: true }).fill(figure.value)
    await page.getByLabel(`Legenda do número ${index + 1}`, { exact: true }).fill(figure.label)
  }
  await expect(numbers).toBeVisible()
  await page.getByRole('button', { name: 'Publicar agora' }).click()
  await expect(page.getByText('No site desde', { exact: false })).toBeVisible({ timeout: 30_000 })

  await page.goto('/')
  const strip = page.locator('dl[data-motion="stats"]')
  await expect(strip).toBeVisible()
  await expect(strip.locator('dt')).toHaveText(FIGURES.map(figure => figure.label))
  // The counters end on the text the owner wrote, and only once they have run
  await expect(strip.locator('dd').nth(0)).toHaveText('6+', { timeout: 5_000 })
  await expect(strip.locator('dd').nth(1)).toHaveText('~5M', { timeout: 5_000 })
  await expect(strip.locator('dd').nth(2)).toHaveText('70–80%')
  await expect(strip.locator('dd').nth(3)).toHaveText('90%+', { timeout: 5_000 })

  // Back as it was: the figures go, and the strip with them
  await page.goto('/admin/paginas/home')
  for (let index = FIGURES.length; index > 0; index--) {
    await page.getByRole('button', { name: `Remover: Número ${index}` }).click()
  }
  await page.getByRole('button', { name: 'Publicar alterações' }).click()
  await expect(page.getByText('No site desde', { exact: false })).toBeVisible({ timeout: 30_000 })
  await page.goto('/')
  await expect(page.locator('dl[data-motion="stats"]')).toHaveCount(0)
})
