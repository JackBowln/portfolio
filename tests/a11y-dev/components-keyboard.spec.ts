// F01-T4: keyboard use of the base components on the dev styleguide (WCAG 2.1.1, 2.4.7)
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dev/styleguide')
  // Handlers exist only after hydration, which can lag in dev
  await page.waitForFunction(() => !!(document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__)
})

test('Enter and Space activate a button; disabled buttons are skipped by Tab', async ({ page }) => {
  const presses = page.getByTestId('sg-presses')
  const first = page.getByTestId('sg-button').first()
  await first.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Space')
  await expect(presses).toHaveText('2')

  const visited: string[] = []
  for (let step = 0; step < 14; step++) {
    await page.keyboard.press('Tab')
    visited.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? ''))
  }
  expect(visited.filter(text => text === 'Desabilitado')).toEqual([])
  expect(visited).toContain('Com ícone')
})

test('Enter follows a link, and the skip link shows up when focused', async ({ page }) => {
  await page.getByRole('link', { name: 'Interno' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#sg-colors$/)

  const skip = page.getByRole('link', { name: /Pular para os componentes/ })
  expect((await skip.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1)
  await skip.focus()
  expect((await skip.boundingBox())?.width ?? 0).toBeGreaterThan(24)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#sg-components$/)
})

test('an unsafe href renders as text, not as a link', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'javascript:alert(1)' })).toHaveCount(0)
  await expect(page.getByText('javascript:alert(1)', { exact: true })).toBeVisible()
})

test('submitting the demo form by keyboard marks the fields and announces the result', async ({ page }) => {
  const email = page.getByLabel('[PLACEHOLDER] E-mail')
  await email.focus()
  await page.keyboard.press('Enter')

  await expect(email).toHaveAttribute('aria-invalid', 'true')
  const describedby = (await email.getAttribute('aria-describedby')) ?? ''
  await expect(page.locator(`[id="${describedby.split(' ').at(-1)}"]`)).toHaveText('[PLACEHOLDER] Informe um e-mail válido.')
  await expect(page.getByRole('alert').filter({ hasText: 'Corrija os campos marcados' })).toBeVisible()

  await email.fill('ana@example.com')
  await page.getByLabel('[PLACEHOLDER] Mensagem').fill('Olá')
  await page.getByRole('button', { name: 'Validar' }).press('Enter')
  await expect(email).not.toHaveAttribute('aria-invalid')
  await expect(page.getByRole('status').filter({ hasText: 'Tudo certo' })).toBeVisible()
})
