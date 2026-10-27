// F01-T2: light and dark themes without FOUC (ADR-0010 §3). The stored theme is applied by the inline head script,
// before any app JS, so these tests block the Nuxt bundle to prove the first paint is already right
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const STORAGE_KEY = 'theme'

async function pageState(page: Page) {
  return page.evaluate(() => ({
    dataTheme: document.documentElement.dataset.theme,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    background: getComputedStyle(document.body).backgroundColor,
  }))
}

async function blockAppJs(page: Page) {
  await page.route('**/_nuxt/**/*.js', route => route.abort())
}

test.describe('no flash of the wrong theme', () => {
  test('a stored dark theme applies before the app loads, over a light system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript(key => localStorage.setItem(key, 'dark'), STORAGE_KEY)
    await blockAppJs(page)
    await page.goto('/')

    const dark = await pageState(page)
    expect(dark.dataTheme).toBe('dark')
    expect(dark.colorScheme).toBe('dark')

    // Same page with no stored theme: the light system theme, and a different background
    await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY)
    await page.context().clearCookies()
    const fresh = await page.context().newPage()
    await fresh.emulateMedia({ colorScheme: 'light' })
    await blockAppJs(fresh)
    await fresh.goto('/')
    const light = await pageState(fresh)
    expect(light.dataTheme).toBeUndefined()
    expect(light.background).not.toBe(dark.background)
  })

  test('without a stored theme the system theme applies, even without JS', async ({ browser, baseURL }) => {
    async function noJsState(colorScheme: 'light' | 'dark', stored?: string) {
      const context = await browser.newContext({ baseURL, javaScriptEnabled: !!stored, colorScheme })
      const page = await context.newPage()
      if (stored) {
        await page.addInitScript(([key, theme]) => localStorage.setItem(key, theme), [STORAGE_KEY, stored] as const)
        await blockAppJs(page)
      }
      await page.goto('/')
      const state = await pageState(page)
      await context.close()
      return state
    }

    const systemDark = await noJsState('dark')
    const systemLight = await noJsState('light')
    const storedDark = await noJsState('light', 'dark')
    expect(systemDark.dataTheme).toBeUndefined()
    // The system theme alone picks the light-dark() side
    expect(systemDark.background).not.toBe(systemLight.background)
    expect(systemDark.background).toBe(storedDark.background)
  })
})

test('the toggle switches the theme by keyboard, keeps it after a reload and sets no cookie', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'Tab focus order is a desktop keyboard check')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const toggle = page.getByRole('button', { name: 'Tema escuro' })
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect((await pageState(page)).dataTheme).toBe('dark')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Tema escuro' })).toHaveAttribute('aria-pressed', 'true')
  expect((await pageState(page)).dataTheme).toBe('dark')
  expect(await context.cookies()).toEqual([])
})

test('the toggle works by touch too', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch check for the mobile project')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  const toggle = page.getByRole('button', { name: 'Tema escuro' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.tap()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect((await pageState(page)).dataTheme).toBe('light')
})
