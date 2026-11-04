// F10-T3: the home's motion in its four variants (storyboard-home §2–§6). The LCP title is visible from the first
// paint; on desktop the opening plays, the story pins with all its steps in the DOM and in reading order, and the
// split title keeps one accessible name; on mobile nothing pins; with reduced motion GSAP never loads and everything
// shows with the hairline drawn; without JS everything shows. Screenshots of each variant go to reports/motion/
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'
import { ensureBlogFixture } from '../support/blog'

const shot = (page: Page, name: string) => page.screenshot({ path: `reports/motion/home-${name}.png`, fullPage: true })
const opacity = (page: Page, selector: string) => page.locator(selector).first().evaluate(element => getComputedStyle(element).opacity)

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('desktop: the title is there from the first paint, the opening plays and the story pins', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The desktop variant')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const title = page.getByRole('main').getByRole('heading', { level: 1 })
  await expect(title).toBeVisible()
  expect(await opacity(page, '[data-motion="hero-title"]')).toBe('1')
  const name = await title.textContent()

  await expect(page.locator('html')).toHaveAttribute('data-motion', 'started', { timeout: 10_000 })
  await expect.poll(() => opacity(page, '[data-motion="hero-subtitle"]'), { timeout: 5000 }).toBe('1')
  await expect(page.locator('.pin-spacer [data-motion="story"]')).toHaveCount(1)
  // Every step is in the DOM and in reading order, not only the visible one
  await expect(page.locator('[data-motion="story-step"]')).toHaveCount(3)
  const snapshot = await page.getByRole('main').ariaSnapshot()
  expect(snapshot.indexOf('Seção 1')).toBeLessThan(snapshot.indexOf('Seção 2'))
  expect(snapshot.indexOf('Seção 2')).toBeLessThan(snapshot.indexOf('Seção 3'))
  // The split title is read as one sentence
  await expect(title).toHaveAccessibleName((name ?? '').trim())
  await expectNoBlockingViolations(page)
  await shot(page, 'desktop')
})

test('mobile: simplified, nothing pins, the steps stack', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The mobile variant')
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'started', { timeout: 10_000 })
  await expect(page.locator('.pin-spacer')).toHaveCount(0)
  const [first, second] = await page.locator('[data-motion="story-step"]').evaluateAll(steps => steps.slice(0, 2).map(step => step.getBoundingClientRect()))
  expect(second!.top).toBeGreaterThanOrEqual(first!.bottom)
  await shot(page, 'mobile')
})

test('reduced motion: no GSAP, everything visible, the hairline drawn', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Once is enough')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForTimeout(3500)
  await expect(page.locator('html')).not.toHaveAttribute('data-motion', 'started')
  expect(await opacity(page, '[data-motion="hero-eyebrow"]')).toBe('1')
  expect(await opacity(page, '[data-motion="hero-subtitle"]')).toBe('1')
  expect(await page.locator('[data-motion="hairline"] line').evaluate(line => getComputedStyle(line).animationName)).toBe('none')
  await expect(page.locator('.pin-spacer')).toHaveCount(0)
  await expectNoBlockingViolations(page)
  await shot(page, 'reduced')
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('everything is visible', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Once is enough')
    await page.goto('/')
    for (const target of ['hero-title', 'hero-eyebrow', 'hero-subtitle', 'hero-cta']) {
      expect(await opacity(page, `[data-motion="${target}"]`), target).toBe('1')
    }
    await expect(page.locator('[data-motion="story-step"]').nth(2)).toBeVisible()
    await shot(page, 'no-js')
  })
})
