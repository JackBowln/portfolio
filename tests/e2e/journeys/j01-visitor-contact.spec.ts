// J-01 (PRD §8): a visitor lands on the home, explores a case study and sends a message. Desktop Chromium and a
// phone (WebKit), through the real navigation; Turnstile runs with Cloudflare's always-pass test key and the message
// is only logged by the local email binding. Each run sends from its own test IP, so RL_PUBLIC never mixes runs
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { ensureBlogFixture } from '../../support/blog'
import { navigate } from '../../support/journeys'

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('J-01: home → a case study → a message sent', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await navigate(page, 'Projetos')
  await expect(page).toHaveURL(/\/projetos$/)
  await page.locator('main a[href="/projetos/x"]').first().click()
  await expect(page).toHaveURL(/\/projetos\/x$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Projeto de exemplo [PLACEHOLDER]' })).toBeVisible()

  const ip = `2001:db8::${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}`
  await page.route('**/api/public/contact', route => route.continue({ headers: { ...route.request().headers(), 'cf-connecting-ip': ip } }))
  await navigate(page, 'Contato')
  await expect(page).toHaveURL(/\/contato$/)
  await expect(page.locator('form[data-ready]')).toBeVisible()
  await page.getByLabel('Nome').fill(`Visitante J-01 ${randomBytes(2).toString('hex')}`)
  await page.getByLabel('E-mail').fill('visitante@example.test')
  await page.getByLabel('Mensagem').fill('Vi o estudo de caso e gostaria de conversar sobre um projeto parecido.')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await expect(page.getByTestId('contact-sent')).toBeVisible({ timeout: 30_000 })
})
