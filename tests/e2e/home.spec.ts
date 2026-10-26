import { expect, test } from '@playwright/test'

test('home renders the placeholder in pt-BR', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('[PLACEHOLDER]')
})

test('the dev styleguide is not served by the production build', async ({ page }) => {
  const response = await page.goto('/dev/styleguide')

  expect(response?.status()).toBe(404)
})
