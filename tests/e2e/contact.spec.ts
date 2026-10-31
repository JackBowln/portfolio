// F08-T3: the contact form in the browser. Errors are announced (a summary that takes the focus, each field marked);
// Turnstile (the always-pass test key) loads only on the contact page and only on interaction; a sent message shows
// the success status and reaches the inbox, where the owner archives and deletes it. Each run sends from its own
// test IP (cf-connecting-ip), so RL_PUBLIC never mixes runs. axe on the form with errors and on the open message
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'

const TURNSTILE = 'challenges.cloudflare.com'

async function openContact(page: Page) {
  const ip = `2001:db8::${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}`
  await page.route('**/api/public/contact', route => route.continue({ headers: { ...route.request().headers(), 'cf-connecting-ip': ip } }))
  await page.goto('/contato')
  // Hydrated: typing earlier is overwritten by the form's first render
  await expect(page.locator('form[data-ready]')).toBeVisible()
}

test('errors are announced and focused, and each field is marked', async ({ page }) => {
  await openContact(page)
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  const summary = page.getByTestId('contact-errors')
  await expect(summary).toBeFocused()
  await expect(summary).toContainText('Corrija 3 campos para enviar')
  await expect(page.getByLabel('Nome')).toHaveAttribute('aria-invalid', 'true')

  await page.getByLabel('Nome').fill('Visitante')
  await page.getByLabel('E-mail').fill('nao-e-email')
  await page.getByLabel('Mensagem').fill('curta')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await expect(summary).toContainText('Corrija 2 campos para enviar')
  await expect(page.getByLabel('E-mail')).toHaveAccessibleDescription(/Informe um e-mail válido/)
  await expect(page.getByLabel('Nome')).not.toHaveAttribute('aria-invalid', 'true')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expectNoBlockingViolations(page)

  // The summary links lead to the fields
  await summary.getByRole('link', { name: /E-mail/ }).click()
  await expect(page).toHaveURL(/#contact-email$/)
})

test('Turnstile loads only on the contact page, on interaction; a sent message reaches the inbox', async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== 'chromium' || isMobile, 'One sending run is enough; the inbox runs in desktop Chromium')
  const thirdParty: string[] = []
  page.on('request', (request) => {
    if (request.url().includes(TURNSTILE)) {
      thirdParty.push(new URL(page.url()).pathname)
    }
  })
  await page.goto('/')
  await page.goto('/sobre')
  await openContact(page)
  expect(thirdParty).toEqual([])

  const name = `Visitante E2E ${randomBytes(3).toString('hex')}`
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('E-mail').fill('visitante@example.test')
  await page.getByLabel('Mensagem').fill('Mensagem enviada pelo teste de ponta a ponta.')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await expect(page.getByTestId('contact-sent')).toBeVisible({ timeout: 20_000 })
  expect(new Set(thirdParty)).toEqual(new Set(['/contato']))
  await expect(page.getByLabel('Nome')).toHaveValue('')

  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
  await page.goto('/admin/mensagens')
  await page.getByRole('link', { name }).click()
  const message = page.getByTestId('contact-message')
  await expect(message.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(message).toContainText('Lida')
  await expectNoBlockingViolations(page)

  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByText('Estado alterado para Arquivada.')).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Excluir' }).click()
  await expect(page).toHaveURL(/\/admin\/mensagens$/)
  await expect(page.getByRole('link', { name })).toHaveCount(0)
})
