import { expect, test } from '@playwright/test'
import { ensureBlogFixture } from '../support/blog'

test('home renders its published hero in pt-BR', async ({ page, request }) => {
  await ensureBlogFixture(request)
  await page.goto('/')

  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  // tests/e2e/pages.spec.ts edits this hero meanwhile, so only its presence is checked here
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(/\S/)
})

test('the dev styleguide is not served by the production build', async ({ page }) => {
  const response = await page.goto('/dev/styleguide')

  expect(response?.status()).toBe(404)
})
