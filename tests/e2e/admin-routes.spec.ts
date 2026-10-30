// F11-T6: admin routes are registered in the browser on the first visit (modules/admin-routes.ts, ADR-0016). A deep
// admin URL opens and survives a reload, a client-side navigation from a public page reaches the admin, an unknown
// admin URL is a 404, and a public page never downloads the admin route table
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Routing is the same everywhere; desktop Chromium covers it')

const ORIGIN = { origin: SITE_ORIGIN }

test.beforeEach(async ({ context }) => {
  expect((await context.request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
})

test('a deep admin URL opens with its layout and guard, and survives a reload', async ({ page }) => {
  await page.goto('/admin/conta/sessoes')
  await expect(page.getByRole('heading', { level: 1, name: 'Sessões' })).toBeVisible()
  await expect(page.getByText(/^Conectado como/)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Sessões' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Artigos' }).click()
  await expect(page).toHaveURL(/\/admin\/artigos$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Artigos' })).toBeVisible()
})

test('a client-side navigation from a public page reaches the admin', async ({ page }) => {
  await page.goto('/sobre')
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
  await page.evaluate(() => {
    const app = (document.querySelector('#__nuxt') as unknown as { __vue_app__: { config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } } } }).__vue_app__
    return app.config.globalProperties.$router.push('/admin/temas')
  })
  await expect(page).toHaveURL(/\/admin\/temas$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Temas' })).toBeVisible()
})

test('an unknown admin URL is a 404', async ({ page }) => {
  await page.goto('/admin/nao-existe')
  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
})

test('a public page never downloads the admin route table', async ({ page }) => {
  const bodies: Promise<string>[] = []
  page.on('response', (response) => {
    if (response.url().endsWith('.js')) {
      bodies.push(response.text().catch(() => ''))
    }
  })
  await page.goto('/blog/x')
  await page.waitForLoadState('networkidle')
  expect((await Promise.all(bodies)).filter(body => body.includes('admin-artigos'))).toEqual([])
})
