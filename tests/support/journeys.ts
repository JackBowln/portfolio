// Shared steps of the PRD journeys (F12-T1, tests/e2e/journeys): sessions, hydration, the site navigation on desktop
// and through the menu on a phone, and the switches the owner journeys need
import { randomBytes } from 'node:crypto'
import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { SITE_ORIGIN } from './auth'

export const ORIGIN = { origin: SITE_ORIGIN }
export const unique = () => randomBytes(3).toString('hex')

export async function signInAsOwner(request: APIRequestContext): Promise<void> {
  expect((await request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
}

/** A click in the middle of hydration can be lost (WebKit): wait for the app first */
export async function hydrated(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
}

/** Follows a link of the main navigation: in the header on wide screens, in the menu dialog on a phone */
export async function navigate(page: Page, name: string): Promise<void> {
  await hydrated(page)
  const header = page.getByRole('banner').getByRole('navigation', { name: 'Navegação principal' })
  if (await header.isVisible()) {
    await header.getByRole('link', { name, exact: true }).click()
    return
  }
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name, exact: true }).click()
}

/** Turns the AI translation on (the fake provider of the test build); a 409 from a parallel save reads again */
export async function enableAi(request: APIRequestContext): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { items } = await (await request.get('/api/admin/settings')).json() as { items: { key: string, version: number, value: Record<string, unknown> }[] }
    const ai = items.find(item => item.key === 'ai_translation')!
    const value = { ...ai.value, enabled: true, model: '@cf/qwen/qwen3-30b-a3b-fp8', dailyNeuronCap: 10_000, perJobNeuronCap: 10_000 }
    if ((await request.put('/api/admin/settings/ai_translation', { headers: ORIGIN, data: { version: ai.version, value } })).status() === 200) {
      return
    }
  }
  throw new Error('could not switch the AI on')
}
