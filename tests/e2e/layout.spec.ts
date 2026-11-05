// F01-T5: public frame (skip link, header, footer) and the mobile menu as a modal dialog (WAI-ARIA APG)
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ensureBlogFixture } from '../support/blog'

test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL })
  await ensureBlogFixture(request)
  await request.dispose()
})

const MOBILE = { width: 390, height: 844 }

async function focused(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    return { id: element?.id ?? '', text: element?.textContent?.trim() ?? '', inMenu: Boolean(element?.closest('#site-menu')) }
  })
}

async function hydrated(page: Page) {
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
}

test('the skip link is the first focus and moves focus to main', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch devices: WebKit on iOS does not move Tab focus to links')
  await page.goto('/sobre')
  await page.keyboard.press('Tab')
  expect((await focused(page)).text).toBe('Pular para o conteúdo')
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeVisible()

  await page.keyboard.press('Enter')
  expect((await focused(page)).id).toBe('main')
  await expect(page.getByRole('main')).toHaveCount(1)
})

test('the header goes name → sections → theme by keyboard, and the current section is marked', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Tab focus order is a desktop keyboard check')
  await page.goto('/sobre')
  await hydrated(page)
  // The theme toggle stays invisible (and unfocusable) until it knows the theme
  await expect(page.getByRole('button', { name: 'Tema escuro' })).toBeVisible()
  const order: string[] = []
  for (let step = 0; step < 7; step++) {
    await page.keyboard.press('Tab')
    order.push((await focused(page)).text)
  }
  expect(order).toEqual(['Pular para o conteúdo', '[PLACEHOLDER]', 'Projetos', 'Blog', 'Sobre', 'Contato', 'Tema escuro'])

  const header = page.getByRole('banner')
  await expect(header.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Sobre' })).toHaveAttribute('aria-current', 'page')
  await expect(header.getByRole('button', { name: 'Menu', exact: true })).toBeHidden()
})

test('the footer repeats the sections, links privacy and holds the language switcher', async ({ page }) => {
  await page.goto('/de/ueber-mich')
  const footer = page.getByRole('contentinfo')
  const nav = footer.getByRole('navigation', { name: 'Fußzeilennavigation' })
  await expect(nav.getByRole('link')).toHaveText(['Projekte', 'Blog', 'Über mich', 'Kontakt', 'Datenschutz'])
  await expect(nav.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/de/datenschutz')
  await expect(footer.getByRole('navigation', { name: 'Sprache' })).toBeVisible()
  await expect(footer).toContainText(`© ${new Date().getUTCFullYear()} [PLACEHOLDER]`)
})

test.describe('mobile menu', () => {
  test.use({ viewport: MOBILE })

  test('traps focus, closes on Esc and gives focus back to its button', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard check, run at 390 px in desktop Chrome')
    await page.goto('/')
    await hydrated(page)
    const button = page.getByRole('button', { name: 'Menu', exact: true })
    const menu = page.getByRole('dialog', { name: 'Menu' })
    await expect(page.getByRole('banner').getByRole('navigation', { name: 'Navegação principal' })).toBeHidden()
    await expect(button).toHaveAttribute('aria-expanded', 'false')

    await button.focus()
    await page.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    expect((await focused(page)).inMenu).toBe(true)

    // Close button + 4 sections, twice around: focus never leaves the dialog
    for (let step = 0; step < 10; step++) {
      await page.keyboard.press('Tab')
      expect((await focused(page)).inMenu, `Tab ${step + 1}`).toBe(true)
    }
    for (let step = 0; step < 3; step++) {
      await page.keyboard.press('Shift+Tab')
      expect((await focused(page)).inMenu, `Shift+Tab ${step + 1}`).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(button).toBeFocused()
    await expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  test('the close button closes it, and following a link closes it on the new page', async ({ page }) => {
    await page.goto('/')
    await hydrated(page)
    const button = page.getByRole('button', { name: 'Menu', exact: true })
    const menu = page.getByRole('dialog', { name: 'Menu' })

    await button.click()
    await menu.getByRole('button', { name: 'Fechar menu' }).click()
    await expect(menu).toBeHidden()
    await expect(button).toHaveAttribute('aria-expanded', 'false')

    await button.click()
    await menu.getByRole('link', { name: 'Sobre' }).click()
    await expect(page).toHaveURL('/sobre')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sobre')
    await expect(menu).toBeHidden()
    await expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  test('opens without JavaScript, through invoker commands', async ({ browser, baseURL, browserName }) => {
    test.skip(browserName !== 'chromium', 'command/commandfor checked in Chromium')
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: MOBILE })
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden()
    await context.close()
  })
})

test('no horizontal scroll at 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  for (const path of ['/', '/de/ueber-mich', '/fr/blog/x', '/de/does-not-exist']) {
    await page.goto(path)
    // WebKit counts the router's replaceState during hydration as a navigation: the next goto waits for it
    await hydrated(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, path).toBe(0)
  }
})

test('the article uses the reading measure', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/blog/x')
  const article = await page.getByRole('main').evaluate(element => element.getBoundingClientRect().width)
  await page.goto('/sobre')
  const institutional = await page.getByRole('main').evaluate(element => element.getBoundingClientRect().width)
  expect(article).toBeLessThan(institutional)
})

test('a client-side navigation to a missing page shows the localized 404', async ({ page }) => {
  await page.goto('/de')
  await hydrated(page)
  await page.evaluate(async () => {
    const app = (document.querySelector('#__nuxt') as unknown as { __vue_app__: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } } }).__vue_app__
    await app.config.globalProperties.$router.push('/de/does-not-exist')
  })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seite nicht gefunden')
  await expect(page.getByRole('link', { name: 'Zurück zur Startseite' })).toHaveAttribute('href', '/de')
})
