// F03-T5: the admin SPA end to end. Sign in (TEST_AUTH session) → dashboard → sessions → revoke the other
// session → that browser loses access. The guard is UX only; the 401 comes from the server
import { expect, test } from '@playwright/test'
import type { BrowserContext } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'

const ORIGIN = { origin: SITE_ORIGIN }

async function signIn(context: BrowserContext, role = 'owner', userId?: string): Promise<string> {
  const query = new URLSearchParams({ role, ...(userId ? { userId } : {}) })
  // Shares the cookie jar with the browser context's pages
  const response = await context.request.post(`/api/_test/session?${query}`, { headers: ORIGIN })
  expect(response.status()).toBe(200)
  return (await response.json()).userId
}

test('without a session, the admin sends the user to the login page', async ({ page }) => {
  await page.goto('/admin/conta/sessoes')
  await page.waitForURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar no admin' })).toBeVisible()
})

test('dashboard → sessions → revoking the other session ends its access', async ({ browser, page, context }) => {
  const userId = await signIn(context)
  const other = await browser.newContext()
  await signIn(other, 'owner', userId)
  const otherPage = await other.newPage()
  await otherPage.goto('/admin')
  await expect(otherPage.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible()

  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible()
  await expect(page.getByTestId('dashboard-card')).toHaveCount(4)
  await expect(page.getByText('Conectado como TEST_AUTH user')).toBeVisible()

  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Sessões' }).click()
  await page.waitForURL(/\/admin\/conta\/sessoes$/)
  await expect(page.getByTestId('session-row')).toHaveCount(2)
  await expect(page.getByText('Este dispositivo')).toHaveCount(1)
  await page.getByRole('button', { name: /^Revogar a sessão de/ }).click()
  await expect(page.getByText('Sessão revogada.')).toBeVisible()
  await expect(page.getByTestId('session-row')).toHaveCount(1)

  // The revoked browser: its next API call is refused and the screen goes back to the login page
  expect((await other.request.get('/api/admin/sessions')).status()).toBe(401)
  await otherPage.goto('/admin/conta/sessoes')
  await otherPage.waitForURL(/\/admin\/login$/)
  await other.close()
})

test('the audit page lists entries and filters them by action', async ({ page, context }) => {
  await signIn(context)
  await page.goto('/admin/auditoria')
  await expect(page.getByRole('heading', { level: 1, name: 'Auditoria' })).toBeVisible()
  await expect(page.getByRole('table').or(page.getByText('Nenhum registro para estes filtros.'))).toBeVisible()
  await page.getByLabel('Ação').selectOption('auth.session_revoked')
  const filtered = page.waitForResponse(response => response.url().includes('action=auth.session_revoked'))
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await filtered
  await expect(page.getByRole('button', { name: 'Filtrar' })).toBeEnabled()
  for (const action of await page.getByTestId('audit-row').locator('code').allTextContents()) {
    expect(action).toBe('auth.session_revoked')
  }
})

test('roles without audit:read do not see the audit link', async ({ page, context }) => {
  await signIn(context, 'editor')
  await page.goto('/admin')
  const nav = page.getByRole('navigation', { name: 'Admin' })
  await expect(nav.getByRole('link', { name: 'Painel' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Auditoria' })).toHaveCount(0)
})

test('the shell works from the keyboard: skip link first, then the navigation', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === 'e2e-mobile', 'Keyboard navigation is checked on desktop')
  await signIn(context)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible()

  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Ir para o conteúdo' })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Painel' })).toBeFocused()

  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused()
})
