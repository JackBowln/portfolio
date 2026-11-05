// F10-T4: page transitions and microinteractions. A project's card cover and its case study image share one
// view-transition name, unique on each page; with support the navigation runs a view transition, without it the
// navigation is plain and error free; with reduced motion no transition runs; focus stays visible
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ensureBlogFixture } from '../support/blog'
import { ORIGIN, unique } from '../support/journeys'
import { readyImage } from '../support/media-api'

// Counts the transitions the page starts (or removes the API, to see the fallback)
async function trackTransitions(page: Page, supported: boolean) {
  await page.addInitScript((keep) => {
    const counter = window as unknown as { __transitions: number }
    counter.__transitions = 0
    const original = Document.prototype.startViewTransition
    if (!keep || !original) {
      delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition
      return
    }
    Document.prototype.startViewTransition = function (this: Document, ...args: Parameters<typeof original>) {
      counter.__transitions++
      return original.apply(this, args)
    }
  }, supported)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

const transitions = (page: Page) => page.evaluate(() => (window as unknown as { __transitions: number }).__transitions)
const names = (page: Page) => page.locator('.vt-project').evaluateAll(elements => elements.map(element => getComputedStyle(element).viewTransitionName))

async function hydrated(page: Page) {
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
}

// A published project with a cover and a result, made here: the fixture's example project has no cover, and the
// test data starts empty on every run (F12-T1)
let covered = ''
test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
  expect((await request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  const cover = await readyImage(request, `capa-transicao-${unique()}.jpg`)
  expect((await request.patch(`/api/admin/media/${cover}`, { headers: ORIGIN, data: { localizations: { 'pt-BR': { alt: 'Capa do projeto com transição' } } } })).status()).toBe(200)
  const created = await (await request.post('/api/admin/projects', { headers: ORIGIN, data: { title: `Com capa ${unique()}` } })).json() as { id: string, localizations: { slug: string }[] }
  const saved = await request.patch(`/api/admin/projects/${created.id}`, { headers: ORIGIN, data: { version: 1, summary: 'Resumo', coverMediaId: cover, highlights: [{ label: 'Resultado', value: '42%' }] } })
  expect(saved.status()).toBe(200)
  expect((await request.post(`/api/admin/projects/${created.id}/publish`, { headers: ORIGIN, data: { locale: 'pt-BR', version: 2 } })).status()).toBe(200)
  covered = created.localizations[0]!.slug
})

test('with support: the card cover becomes the case study image through a view transition', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The morph is desktop only; mobile only crossfades')
  const errors = await trackTransitions(page, true)
  await page.goto('/projetos')
  await hydrated(page)
  const listed = await names(page)
  expect(listed.length).toBeGreaterThan(0)
  expect(new Set(listed).size).toBe(listed.length)
  expect(listed).toContain(`project-${covered}`)
  const slug = covered
  await page.locator(`article:has(.vt-project) a[href$="/projetos/${slug}"]`).first().click()
  await expect(page).toHaveURL(new RegExp(`/projetos/${slug}$`))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await transitions(page)).toBeGreaterThan(0)
  const onPage = await names(page)
  // Its own name, once (related projects carry theirs)
  expect(onPage).toContain(`project-${slug}`)
  expect(new Set(onPage).size).toBe(onPage.length)
  expect(errors).toEqual([])
})

test('without support: a plain navigation, without errors', async ({ page }) => {
  const errors = await trackTransitions(page, false)
  await page.goto('/projetos')
  await hydrated(page)
  await page.getByRole('link', { name: 'Projeto de exemplo [PLACEHOLDER]' }).first().click()
  await expect(page).toHaveURL(/\/projetos\/x$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(errors).toEqual([])
})

test('with reduced motion: no transition, and focus stays visible on the link pressed', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Once is enough')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = await trackTransitions(page, true)
  await page.goto('/projetos')
  await hydrated(page)
  const link = page.getByRole('link', { name: 'Projeto de exemplo [PLACEHOLDER]' }).first()
  await link.focus()
  expect(await link.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/projetos\/x$/)
  expect(await transitions(page)).toBe(0)
  expect(errors).toEqual([])
})

test('on mobile the shared names are off: only the crossfade', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The mobile variant')
  await page.goto('/projetos')
  expect(new Set(await names(page))).toEqual(new Set(['none']))
})

test('the case study starts its motion and every highlight ends on its original text', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Once is enough')
  await page.goto(`/projetos/${covered}`)
  const values = page.locator('[data-motion="highlight-value"]')
  const before = await values.allTextContents()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'started', { timeout: 10_000 })
  await page.mouse.wheel(0, 4000)
  await page.waitForTimeout(1500)
  expect((await values.allTextContents()).map(text => text.trim())).toEqual(before.map(text => text.trim()))
  // Each value is read once: no hidden copy is left behind
  await expect(page.locator('[data-motion="highlight-value"] .sr-only')).toHaveCount(0)
})
