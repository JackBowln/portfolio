// F11-T1: after a client-side navigation the head carries the new page's JSON-LD, one block, parseable
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ensureBlogFixture } from '../support/blog'

const types = (page: Page) => page.locator('script[type="application/ld+json"]').evaluateAll(scripts =>
  scripts.flatMap(script => (JSON.parse(script.textContent ?? '{}') as { '@graph'?: { '@type': string }[] })['@graph']?.map(node => node['@type']) ?? []))

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('the JSON-LD follows client-side navigation', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Once is enough')
  await page.goto('/')
  await expect.poll(() => types(page)).toEqual(['WebSite', 'Person'])
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Blog' }).click()
  await expect(page).toHaveURL(/\/blog$/)
  await expect.poll(() => types(page)).toEqual(['CollectionPage', 'BreadcrumbList'])
  // Whichever article comes first: other specs publish in parallel
  await page.getByRole('main').getByRole('article').first().getByRole('link').first().click()
  await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+$/)
  await expect.poll(() => types(page)).toEqual(['BlogPosting', 'BreadcrumbList'])
})
