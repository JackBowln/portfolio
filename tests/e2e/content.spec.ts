// F05-T4: the public renderer on the test page, with the document that has every node type and real library
// media. On a first visit the renderer's code is never downloaded (hydrate-never) and only the enhancement script
// loads; copy and the gallery work, by keyboard too; without JS the content is whole; after a client-side
// navigation it renders in the browser; and nothing is requested from another origin
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { CODE } from '../support/documents'
import { readyImage, readyVideo, uniqueName } from '../support/media-api'

// A string only the renderer's own code holds (a class set in ContentBlocks.ts)
const RENDERER_MARKER = 'content-callout-label'

async function createMedia(request: APIRequestContext): Promise<string> {
  expect((await request.post('/api/_test/session?role=owner', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
  const photo = await readyImage(request, uniqueName('foto', 'jpg'))
  const second = await readyImage(request, uniqueName('segunda', 'jpg'))
  const third = await readyImage(request, uniqueName('terceira', 'jpg'))
  const poster = await readyImage(request, uniqueName('capa', 'jpg'))
  const clip = await readyVideo(request, uniqueName('clipe', 'mp4'), poster)
  return `/_test/content?${new URLSearchParams({ photo, second, third, clip, poster })}`
}

/** Bodies of the scripts the page loads (prefetches included), by URL */
function recordScripts(page: Page): Map<string, Promise<string>> {
  const scripts = new Map<string, Promise<string>>()
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('.js')) {
      scripts.set(response.url(), response.text().catch(() => ''))
    }
  })
  return scripts
}

async function loadedRenderer(scripts: Map<string, Promise<string>>): Promise<string[]> {
  const found: string[] = []
  for (const [url, body] of scripts) {
    if ((await body).includes(RENDERER_MARKER)) {
      found.push(url)
    }
  }
  return found
}

let path: string
test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL })
  path = await createMedia(request)
  await request.dispose()
})

test('a first visit keeps the server HTML and downloads no renderer code', async ({ page }) => {
  const scripts = recordScripts(page)
  const outside: string[] = []
  const messages: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith('data:') && new URL(request.url()).origin !== SITE_ORIGIN) {
      outside.push(request.url())
    }
  })
  page.on('console', message => messages.push(message.text()))

  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Introdução' })).toBeVisible()
  // The enhancement script ran: the copy button appears
  await expect(page.getByRole('button', { name: 'Copiar' })).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(await loadedRenderer(scripts)).toEqual([])
  // Not even announced as a hint for later
  const hinted = await page.locator('link[rel="prefetch"], link[rel="modulepreload"], link[rel="preload"]').evaluateAll(links => links.map(link => (link as HTMLLinkElement).href))
  const hintedBodies = await Promise.all(hinted.filter(href => href.endsWith('.js')).map(href => page.request.get(href).then(response => response.text())))
  expect(hintedBodies.filter(body => body.includes(RENDERER_MARKER))).toEqual([])
  expect(outside).toEqual([])
  expect(messages.filter(text => /hydrat|mismatch/i.test(text))).toEqual([])
  // Every node type is in the HTML the server sent
  for (const selector of ['h2#introducao', 'h3#listas', 'h4#midia', 'ul', 'ol[start="3"]', 'blockquote', '.content-callout', 'hr', '.content-code pre', '.content-figure img', '.content-gallery dialog', 'video', '.content-embed a', '.content-table table']) {
    await expect(page.locator(`.content ${selector}`).first()).toBeAttached()
  }
})

test('copy puts the code on the clipboard and says so', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium-only in Playwright')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(path)
  const copy = page.getByRole('button', { name: 'Copiar' })
  await copy.click()
  await expect(page.locator('[data-content-copy-status]')).toHaveText('Copiado')
  await expect(page.locator('.content-code-copy')).toHaveText('Copiado')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE)
  await expect(page.locator('.content-code-copy')).toHaveText('Copiar', { timeout: 5000 })
})

test('the gallery opens and closes by keyboard, returning focus', async ({ page }) => {
  await page.goto(path)
  await expect(page.getByRole('button', { name: 'Copiar' })).toBeVisible()
  const open = page.getByRole('button', { name: /Ampliar imagem 2 de 3/ })
  await open.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Imagem 2 de 3' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('img')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(open).toBeFocused()

  await open.click()
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(dialog).toBeHidden()
})

test('a heading anchor takes focus with a visible ring and links to its heading', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Tab order is a desktop keyboard check')
  await page.goto(path)
  const anchor = page.getByRole('link', { name: 'Link para a seção “Listas”' })
  await anchor.focus()
  await expect(anchor).toBeFocused()
  const outline = await anchor.evaluate(element => getComputedStyle(element).outlineStyle)
  expect(outline).toBe('solid')
  await anchor.press('Enter')
  await expect(page).toHaveURL(/#listas$/)
})

test('without JS the content is whole and the copy button stays hidden', async ({ browser, browserName }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Introdução' })).toBeVisible()
  await expect(page.locator('.content-code code')).toHaveText(CODE)
  await expect(page.locator('.content-code-copy')).toBeHidden()
  await expect(page.locator('.content-table td')).toHaveText('Valor')
  if (browserName === 'chromium') {
    // Invoker commands open the dialog with no script at all
    await page.getByRole('button', { name: /Ampliar imagem 1 de 3/ }).click()
    await expect(page.getByRole('dialog', { name: 'Imagem 1 de 3' })).toBeVisible()
  }
  await context.close()
})

test('after a client-side navigation the renderer renders in the browser', async ({ page }) => {
  const scripts = recordScripts(page)
  await page.goto(path)
  await expect(page.getByRole('button', { name: 'Copiar' })).toBeVisible()
  // Away through the header's home link (a client-side navigation), then back
  await page.locator('header a[href="/"]').first().click()
  await expect(page).toHaveURL(/\/$/)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Introdução' })).toBeVisible()
  await expect(page.locator('.content-gallery dialog')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Copiar' })).toBeVisible()
  expect((await loadedRenderer(scripts)).length).toBeGreaterThan(0)
})
