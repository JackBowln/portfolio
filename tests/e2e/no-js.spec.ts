// F12-T1 (RNF-04, RX): every public route reads without JavaScript. The server-rendered page has its heading, its main
// text, the site navigation as real links (in the header, or in the phone menu, which opens without JS), images with
// alt, no content kept hidden by motion, and the language switcher as plain links. Desktop Chromium and a phone (WebKit)
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ensureBlogFixture } from '../support/blog'

test.use({ javaScriptEnabled: false })

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

const ROUTES: [string, number][] = [
  ['/', 200],
  ['/blog', 200],
  ['/blog/x', 200],
  ['/blog/temas/x', 200],
  ['/projetos', 200],
  ['/projetos/x', 200],
  ['/sobre', 200],
  ['/contato', 200],
  ['/privacidade', 200],
  ['/de/blog/x', 200],
  ['/en/about', 200],
  ['/fr/projets/x', 200],
  ['/esta-pagina-nao-existe', 404],
]

async function navigationLinks(page: Page) {
  const header = page.getByRole('banner').getByRole('navigation')
  if (await header.first().isVisible()) {
    return header.first().getByRole('link')
  }
  // A phone: the menu opens without JS and lists the sections
  // Its name in the page's language: Menu, Menú, Menü
  await page.getByRole('banner').getByRole('button', { name: /^Men[uúü]$/ }).click()
  const menu = page.getByRole('dialog', { name: /^Men[uúü]$/ })
  await expect(menu).toBeVisible()
  return menu.getByRole('navigation').first().getByRole('link')
}

for (const [path, status] of ROUTES) {
  test(`${path} reads without JS`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(status)
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    expect((await heading.innerText()).trim().length).toBeGreaterThan(0)
    // Motion never hides content: nothing that waits for an animation is left invisible
    expect(await page.locator('main [data-motion]').evaluateAll(nodes => nodes.filter(node => Number(getComputedStyle(node).opacity) < 0.99).length)).toBe(0)
    expect((await page.getByRole('main').innerText()).trim().length).toBeGreaterThan(30)
    // Images: every one has an alt (empty only when decorative)
    expect(await page.locator('img:not([alt])').count()).toBe(0)
    // The language switcher is plain links with an href
    const switcher = page.getByRole('contentinfo').getByRole('navigation').filter({ has: page.locator('a[hreflang]') })
    expect(await switcher.locator('a[hreflang]').evaluateAll(links => links.every(link => link.getAttribute('href')?.startsWith('/')))).toBe(true)

    const links = await navigationLinks(page)
    expect(await links.count()).toBeGreaterThanOrEqual(3)
    expect(await links.evaluateAll(nodes => nodes.every(node => (node as HTMLAnchorElement).getAttribute('href')?.startsWith('/')))).toBe(true)
  })
}
