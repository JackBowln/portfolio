// J-02 (PRD §8): a reader finds an article through a search engine in German, reads it and switches to English. The
// site has no search of its own, so the journey starts where a search result leads: the German article's URL, with
// a search referrer. Its head is German (lang, canonical, hreflang to the other published locales); the switcher
// leads to the English version of the same article, never to a 404
import { expect, test } from '@playwright/test'
import { ensureBlogFixture } from '../../support/blog'
import { hydrated } from '../../support/journeys'

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('J-02: a German search result → read → switch to English', async ({ page, baseURL }) => {
  await page.goto('/de/blog/x', { referer: 'https://www.google.de/' })
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('heading', { level: 1, name: 'Example article (de) [PLACEHOLDER]' })).toBeVisible()
  await expect(page.getByRole('article')).toContainText('Primeira seção')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${baseURL}/de/blog/x`)
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', `${baseURL}/en/blog/x`)

  await hydrated(page)
  await page.getByRole('contentinfo').getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/en\/blog\/x$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1, name: 'Example article (en) [PLACEHOLDER]' })).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${baseURL}/en/blog/x`)
})
