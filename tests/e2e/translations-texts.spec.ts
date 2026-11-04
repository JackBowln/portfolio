// F09-T5: short texts in batch in the browser, with the fake provider. A topic used by a published article is
// translated into English with AI (estimate, confirmation), edited, saved to review and approved; axe on the screen
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'

const headers = { origin: SITE_ORIGIN }

async function enableAi(request: APIRequestContext) {
  // Other specs save the AI settings in parallel; a 409 means read the version again
  for (let attempt = 0; attempt < 10; attempt++) {
    const { items } = await (await request.get('/api/admin/settings')).json() as { items: { key: string, version: number, value: Record<string, unknown> }[] }
    const ai = items.find(item => item.key === 'ai_translation')!
    const value = { ...ai.value, enabled: true, model: '@cf/qwen/qwen3-30b-a3b-fp8', dailyNeuronCap: 10_000, perJobNeuronCap: 10_000 }
    if ((await request.put('/api/admin/settings/ai_translation', { headers, data: { version: ai.version, value } })).status() === 200) {
      return
    }
  }
  throw new Error('could not switch the AI on')
}

test('translate a topic name in batch, edit, save and approve it', async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== 'chromium' || isMobile, 'The batch screen runs in desktop Chromium here')
  const request = page.context().request
  expect((await request.post('/api/_test/session?role=owner', { headers })).status()).toBe(200)
  await enableAi(request)
  const name = `Tema lote ${randomBytes(3).toString('hex')}`
  const topic = await (await request.post('/api/admin/tags', { headers, data: { name } })).json() as { id: string }
  const { id } = await (await request.post('/api/admin/articles', { headers, data: { title: `Artigo ${name}` } })).json() as { id: string }
  expect((await request.patch(`/api/admin/articles/${id}`, { headers, data: { version: 1, excerpt: 'x', tagIds: [topic.id] } })).status()).toBe(200)
  expect((await request.post(`/api/admin/articles/${id}/publish`, { headers, data: { locale: 'pt-BR', version: 2 } })).status()).toBe(200)

  await page.goto('/admin/traducoes/textos')
  await expect(page.getByRole('heading', { level: 1, name: 'Textos curtos' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
  const item = page.locator(`[data-testid="text-item"][data-key="tag:${topic.id}"]`)
  await expect(item).toContainText(name)
  await item.getByLabel(`Escolher: ${name}`).check()
  await page.getByRole('button', { name: 'Traduzir 1 item escolhido com IA' }).click()
  await page.getByRole('button', { name: 'Confirmar e traduzir' }).click()
  await expect(page.getByTestId('texts-status')).toHaveText('Tradução pronta para revisão.')
  const field = item.getByLabel('Nome — Tradução (en)')
  await expect(field).toHaveValue(`[en] ${name}`)
  await expectNoBlockingViolations(page)

  await field.fill(`Batch topic ${name.slice(-6)}`)
  await page.getByRole('button', { name: 'Salvar revisão' }).click()
  await expect(page.getByTestId('texts-status')).toHaveText('1 item salvo para revisão.')
  await item.getByLabel(`Escolher: ${name}`).check()
  await page.getByRole('button', { name: 'Aprovar 1 item escolhido' }).click()
  await expect(page.getByTestId('texts-status')).toHaveText('1 item aprovado.')
  const { items } = await (await request.get('/api/admin/translations/texts?locale=en')).json() as { items: { key: string, state: string, fields: { translation: string }[] }[] }
  expect(items.find(entry => entry.key === `tag:${topic.id}`)).toMatchObject({ state: 'approved', fields: [{ translation: `Batch topic ${name.slice(-6)}` }] })
})
