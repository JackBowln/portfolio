// F03-T5: the admin screens meet WCAG 2.2 AA (no serious or critical axe violations), in both themes
import { expect, test } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'

const SCREENS = [
  { path: '/admin', heading: 'Painel' },
  { path: '/admin/conta/sessoes', heading: 'Sessões' },
  { path: '/admin/auditoria', heading: 'Auditoria' },
  { path: '/admin/conta/passkeys', heading: 'Passkeys' },
  { path: '/admin/midia', heading: 'Mídia' },
]

for (const colorScheme of ['light', 'dark'] as const) {
  for (const { path, heading } of SCREENS) {
    test(`${path} has no serious or critical axe violations (${colorScheme})`, async ({ page, context }) => {
      // TEST_AUTH route: exists only in the test build
      expect((await context.request.post('/api/_test/session?role=owner', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await page.waitForLoadState('networkidle')

      await expectNoBlockingViolations(page)
    })
  }
}

// F04-T4: the library screens with a real item, and its dialogs open
for (const colorScheme of ['light', 'dark'] as const) {
  test(`media detail, delete dialog and media picker have no serious or critical axe violations (${colorScheme})`, async ({ page, context }) => {
    const request = context.request
    expect((await request.post('/api/_test/session?role=owner', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
    const listed = await (await request.get('/api/admin/media', { params: { kind: 'image', status: 'ready', limit: '1' } })).json()
    test.skip(listed.items.length === 0, 'needs one uploaded image (the media API specs create them)')
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })

    await page.goto(`/admin/midia/${listed.items[0].id}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expectNoBlockingViolations(page)

    const remove = page.getByRole('button', { name: 'Excluir mídia' })
    if (await remove.isEnabled()) {
      await remove.click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await expectNoBlockingViolations(page)
      await page.keyboard.press('Escape')
    }

    await page.goto('/admin/midia')
    await page.getByRole('button', { name: 'Escolher poster' }).click()
    await expect(page.getByRole('dialog', { name: 'Escolher da biblioteca' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expectNoBlockingViolations(page)
  })
}
