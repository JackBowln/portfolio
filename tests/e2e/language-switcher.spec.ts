import { expect, test } from '@playwright/test'
import { ensureBlogFixture } from '../support/blog'
import { hydrated } from '../support/journeys'

test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL })
  await ensureBlogFixture(request)
  await request.dispose()
})

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
      // A click in the middle of hydration can be lost (WebKit); the institutional pages hydrate with their content
      await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
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
  // The case study is real since F07-T2: the fixture's German title
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Example project (de) [PLACEHOLDER]')
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

test('dates are formatted with Intl in the active language and the site time zone', async ({ page, request }) => {
  // The fixture article (tests/support/blog.ts); its date is the moment it was first published
  const { firstPublishedAt } = await (await request.get('/api/public/blog/x?locale=pt-BR')).json() as { firstPublishedAt: string }
  const date = (language: string) => new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(firstPublishedAt))
  const expected = {
    'pt-BR': `Publicado em ${date('pt-BR')}`,
    'en': `Published on ${date('en')}`,
    'de': `Veröffentlicht am ${date('de')}`,
  }
  for (const [locale, text] of Object.entries(expected)) {
    await page.goto(`${locale === 'pt-BR' ? '' : `/${locale}`}/blog/x`)
    await expect(page.getByText(text)).toBeVisible()
    // WebKit counts the router's replaceState during hydration as a navigation: the next goto waits for it
    await hydrated(page)
  }
})
