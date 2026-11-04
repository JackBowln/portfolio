// F10-T2: the motion infrastructure in the browser. GSAP (recognized by its code, not its hashed name) is fetched on
// the home after the load, and never with reduced motion from the system or the site's button, nor on a blog
// article; without JS everything is visible; a page that starts no motion drops html.motion-ok within 3 s; the
// footer button turns motion off and remembers it
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ensureBlogFixture } from '../support/blog'

const GSAP_MARKER = 'autoSleep:120'

function watchGsap(page: Page) {
  const fetched: string[] = []
  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/_nuxt/') && url.endsWith('.js') && (await response.text().catch(() => '')).includes(GSAP_MARKER)) {
      fetched.push(url)
    }
  })
  return fetched
}

const settle = (page: Page) => page.waitForTimeout(3500)

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('the home fetches GSAP after the load and starts motion', async ({ page }) => {
  const fetched = watchGsap(page)
  await page.goto('/')
  await expect.poll(() => fetched.length, { timeout: 10_000 }).toBeGreaterThan(0)
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'started')
  await expect(page.locator('html')).toHaveClass(/motion-ok/)
})

test('reduced motion from the system: no GSAP, no motion class', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const fetched = watchGsap(page)
  await page.goto('/')
  await settle(page)
  expect(fetched).toEqual([])
  await expect(page.locator('html')).not.toHaveClass(/motion-ok/)
})

test('the site button: turning it on stops motion at once and keeps GSAP away on the next visit', async ({ page }) => {
  const fetched = watchGsap(page)
  await page.goto('/sobre')
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
  const button = page.getByTestId('reduce-motion')
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', '1')
  await page.goto('/')
  await settle(page)
  expect(fetched).toEqual([])
  await expect(page.locator('html')).not.toHaveClass(/motion-ok/)
  await expect(page.getByTestId('reduce-motion')).toHaveAttribute('aria-pressed', 'true')
})

test('a blog article never fetches GSAP, and a page without motion drops the class within 3 s', async ({ page }) => {
  const fetched = watchGsap(page)
  await page.goto('/blog/x')
  await settle(page)
  expect(fetched).toEqual([])
  await expect(page.locator('html')).not.toHaveClass(/motion-ok/)
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('the home shows everything', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('html')).not.toHaveClass(/motion-ok/)
  })
})
