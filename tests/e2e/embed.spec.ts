// F05-T5: the embed facade on the content test page. Nothing goes to another origin before the reader clicks; the
// click (or Enter) swaps in the privacy-preserving player with its title, sandbox, allow and referrer policy and
// moves focus to it; the box keeps its size; without JS the caption still links to the video. The players' hosts
// are answered by the test, so no request leaves the machine
import { expect, test } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { contentFixturePath } from '../support/media-api'

const PLAYER = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1'

let path: string
test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL })
  path = await contentFixturePath(request)
  await request.dispose()
})

/** Every request to another origin; the players' hosts get an empty page instead of the network */
async function watchOutside(page: Page): Promise<Request[]> {
  const outside: Request[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith('data:') && new URL(request.url()).origin !== SITE_ORIGIN) {
      outside.push(request)
    }
  })
  await page.context().route(/^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>player</title>' }))
  return outside
}

test('nothing is requested from the provider until the reader plays the video', async ({ page }) => {
  const outside = await watchOutside(page)
  await page.goto(path)
  const play = page.getByRole('button', { name: 'Reproduzir vídeo: Palestra sobre acessibilidade' })
  await expect(play).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(outside.map(request => request.url())).toEqual([])

  const box = page.locator('.content-embed-frame')
  await box.scrollIntoViewIfNeeded()
  const size = async () => box.evaluate(element => [element.clientWidth, element.clientHeight])
  const before = await size()
  await play.click()

  const iframe = page.locator('.content-embed-frame iframe')
  await expect(iframe).toHaveAttribute('src', PLAYER)
  await expect(iframe).toHaveAttribute('title', 'Palestra sobre acessibilidade')
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups')
  await expect(iframe).toHaveAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen')
  await expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
  await expect(iframe).toBeFocused()
  await expect.poll(() => outside.map(request => new URL(request.url()).origin)).toContain('https://www.youtube-nocookie.com')
  expect(outside.every(request => request.url().startsWith('https://www.youtube-nocookie.com/'))).toBe(true)
  // The 16:9 box keeps its size: playing shifts nothing
  expect(await size()).toEqual(before)
  expect(before[0]! / before[1]!).toBeCloseTo(16 / 9, 1)
})

test('the facade plays by keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard check on desktop')
  await watchOutside(page)
  await page.goto(path)
  const play = page.getByRole('button', { name: /Reproduzir vídeo/ })
  await play.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.content-embed-frame iframe')).toBeFocused()
})

test('without JS there is no dead play button and the caption links to the video', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const outside: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith('data:') && new URL(request.url()).origin !== SITE_ORIGIN) {
      outside.push(request.url())
    }
  })
  await page.goto(path)
  await expect(page.locator('.content-embed-play')).toBeHidden()
  await expect(page.getByRole('link', { name: 'Assistir no YouTube: Palestra sobre acessibilidade' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  expect(outside).toEqual([])
  await context.close()
})
