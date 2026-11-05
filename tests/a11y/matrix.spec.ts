// F12-T2 (accessibility.md §1): the axe matrix of the public site (it replaces the per-page specs of F01–F08). Every template × (pt-BR, de) × (light, dark) ×
// (reduced, full motion), with WCAG 2.0–2.2 A and AA tags; serious and critical violations fail. The article and the
// case study are the audit's reference content (a cover, a figure, a gallery and code); in German, the fixture's
// translated article and project. With full motion the page is checked once its scenes have started and the entrances
// have played, so nothing is measured halfway through a fade
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { expectNoBlockingViolations } from '../support/axe'
import { ensureBlogFixture } from '../support/blog'
import { ensureReferenceContent, previewLink, REFERENCE } from '../support/reference-content'

const TEMPLATES: { 'name': string, 'pt-BR': string, 'de': string | null, 'status'?: number }[] = [
  { 'name': 'home', 'pt-BR': '/', 'de': '/de' },
  { 'name': 'blog list', 'pt-BR': '/blog', 'de': '/de/blog' },
  { 'name': 'article', 'pt-BR': `/blog/${REFERENCE.article}`, 'de': '/de/blog/x' },
  { 'name': 'topic', 'pt-BR': '/blog/temas/x', 'de': '/de/blog/themen/x' },
  { 'name': 'project list', 'pt-BR': '/projetos', 'de': '/de/projekte' },
  { 'name': 'project list filtered', 'pt-BR': '/projetos?tech=tecnologia-x', 'de': '/de/projekte?tech=tecnologia-x' },
  { 'name': 'case study', 'pt-BR': `/projetos/${REFERENCE.project}`, 'de': '/de/projekte/x' },
  { 'name': 'about', 'pt-BR': '/sobre', 'de': '/de/ueber-mich' },
  { 'name': 'contact', 'pt-BR': '/contato', 'de': '/de/kontakt' },
  { 'name': 'privacy', 'pt-BR': '/privacidade', 'de': '/de/datenschutz' },
  { 'name': '404', 'pt-BR': '/esta-pagina-nao-existe', 'de': '/de/gibt-es-nicht', 'status': 404 },
]

let preview = ''

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
  await ensureReferenceContent(request)
  preview = await previewLink(request)
})

/** With full motion, wait for the page's scenes (if any) and their entrances */
async function settle(page: Page, motion: 'reduce' | 'no-preference') {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  if (motion === 'reduce' || (await page.locator('main [data-motion]').count()) === 0) {
    return
  }
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'started', { timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), { timeout: 10_000 }).toBe(0)
  await page.waitForFunction(() => {
    const gsap = (window as { gsap?: { globalTimeline: { getChildren: () => { isActive: () => boolean }[] } } }).gsap
    return !gsap || gsap.globalTimeline.getChildren().every(tween => !tween.isActive())
  }, undefined, { timeout: 10_000 })
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const motion of ['reduce', 'no-preference'] as const) {
    for (const template of TEMPLATES) {
      for (const locale of ['pt-BR', 'de'] as const) {
        const path = template[locale]
        if (!path) {
          continue
        }
        test(`${template.name} (${locale}, ${colorScheme}, motion ${motion})`, async ({ page }) => {
          await page.emulateMedia({ colorScheme, reducedMotion: motion })
          const response = await page.goto(path)
          expect(response?.status()).toBe(template.status ?? 200)
          await settle(page, motion)
          await expectNoBlockingViolations(page)
        })
      }
    }
    test(`preview (pt-BR, ${colorScheme}, motion ${motion})`, async ({ browser }) => {
      // Someone signed out opens the link
      const guest = await browser.newContext()
      const page = await guest.newPage()
      await page.emulateMedia({ colorScheme, reducedMotion: motion })
      await page.goto(preview)
      await expect(page.getByTestId('preview-band')).toBeVisible()
      await settle(page, motion)
      await expectNoBlockingViolations(page)
      await guest.close()
    })
  }
}
