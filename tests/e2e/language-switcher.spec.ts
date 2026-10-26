import { expect, test } from '@playwright/test'

const ABOUT = { 'pt-BR': '/sobre', 'en': '/en/about', 'es': '/es/sobre-mi', 'de': '/de/ueber-mich', 'fr': '/fr/a-propos' }
const NAMES = { 'pt-BR': 'Português (Brasil)', 'en': 'English', 'es': 'Español', 'de': 'Deutsch', 'fr': 'Français' }
const TITLES = { 'pt-BR': 'Sobre', 'en': 'About', 'es': 'Sobre mí', 'de': 'Über mich', 'fr': 'À propos' }
type Locale = keyof typeof ABOUT
const LOCALES = Object.keys(ABOUT) as Locale[]

test('the switcher lists every language by its own name, marked with lang', async ({ page }) => {
  await page.goto('/en/about')
  const switcher = page.getByRole('navigation', { name: 'Language' })

  for (const locale of LOCALES) {
    const link = switcher.getByRole('link', { name: NAMES[locale] })
    await expect(link).toHaveAttribute('lang', locale)
    await expect(link).toHaveAttribute('hreflang', locale)
    await expect(link).toHaveAttribute('href', ABOUT[locale])
  }
  await expect(switcher.getByRole('link', { name: 'English' })).toHaveAttribute('aria-current', 'page')
})

test('the switcher leads to the equivalent page in each language', async ({ page }) => {
  for (const from of LOCALES) {
    for (const to of LOCALES.filter(locale => locale !== from)) {
      await page.goto(ABOUT[from])
      await page.getByRole('link', { name: NAMES[to] }).click()

      await expect(page).toHaveURL(ABOUT[to])
      await expect(page.locator('html')).toHaveAttribute('lang', to)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLES[to])
    }
  }
})

test('dynamic routes keep their parameter when switching', async ({ page }) => {
  await page.goto('/projetos/x')
  await page.getByRole('link', { name: 'Deutsch' }).click()

  await expect(page).toHaveURL('/de/projekte/x')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projekt')
})

test('the switcher works with the keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch devices: WebKit on iOS does not move Tab focus to links')
  await page.goto('/sobre')
  const target = page.getByRole('link', { name: 'Français' })

  for (let step = 0; step < 20 && !(await target.evaluate(element => element === document.activeElement)); step++) {
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL('/fr/a-propos')
})

test('dates are formatted with Intl in the active language', async ({ page }) => {
  const expected = {
    'pt-BR': 'Data de exemplo: 15 de janeiro de 2026',
    'en': 'Sample date: January 15, 2026',
    'de': 'Beispieldatum: 15. Januar 2026',
  }
  for (const [locale, text] of Object.entries(expected)) {
    await page.goto(`${locale === 'pt-BR' ? '' : `/${locale}`}/blog/x`)
    await expect(page.getByText(text)).toBeVisible()
  }
})
