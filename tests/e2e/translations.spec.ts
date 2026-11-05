// F09-T4: the translation journeys in the browser, with the fake provider of the test build. J-05: translate an
// article into English with AI → review side by side → approve → publish → /en/blog/<slug> exists, with reciprocal
// hreflang. J-06: edit the original → only the edited segment is outdated → retranslate it → approve. axe on the
// review screen
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'

const headers = { origin: SITE_ORIGIN }

const body = (second: string) => ({
  type: 'doc',
  attrs: { schemaVersion: 1 },
  content: [
    { type: 'paragraph', attrs: { id: 'a' }, content: [{ type: 'text', text: 'Primeiro parágrafo' }] },
    { type: 'paragraph', attrs: { id: 'b' }, content: [{ type: 'text', text: second }] },
  ],
})

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

async function hydrated(page: Page) {
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
}

test.describe.configure({ mode: 'serial' })

test('J-05 and J-06: translate, review, approve, publish; then the source changes', async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== 'chromium' || isMobile, 'The review runs in desktop Chromium here')
  const request = page.context().request
  expect((await request.post('/api/_test/session?role=owner', { headers })).status()).toBe(200)
  await enableAi(request)
  const title = `Tradução E2E ${randomBytes(3).toString('hex')}`
  const created = await request.post('/api/admin/articles', { headers, data: { title } })
  const { id } = await created.json() as { id: string }
  expect((await request.patch(`/api/admin/articles/${id}`, { headers, data: { version: 1, excerpt: 'Resumo', body: body('Segundo parágrafo') } })).status()).toBe(200)
  expect((await request.post(`/api/admin/articles/${id}/publish`, { headers, data: { locale: 'pt-BR', version: 2 } })).status()).toBe(200)

  // J-05
  await page.goto(`/admin/traducoes/article/${id}/en`)
  await expect(page.getByRole('heading', { level: 1, name: `${title} — en` })).toBeVisible()
  await hydrated(page)
  await page.getByRole('button', { name: 'Traduzir com IA' }).click()
  await expect(page.getByTestId('ai-estimate')).toContainText('4 trechos')
  await page.getByRole('button', { name: 'Confirmar e traduzir' }).click()
  await expect(page.getByTestId('review-status')).toHaveText('Tradução pronta para revisão.')
  const segments = page.getByTestId('review-segment')
  await expect(segments).toHaveCount(4)
  await expectNoBlockingViolations(page)

  const englishTitle = `English ${title}`
  const slug = `english-${randomBytes(3).toString('hex')}`
  await segments.first().getByLabel('Tradução (en)').fill(englishTitle)
  await page.getByLabel('Endereço no idioma').fill(slug)
  await page.getByRole('button', { name: 'Salvar revisão' }).click()
  await expect(page.getByTestId('review-status')).toHaveText('Revisão salva. A tradução está em revisão.')
  await page.getByRole('button', { name: 'Aprovar tradução' }).click()
  await expect(page.getByTestId('review-status')).toHaveText('Tradução aprovada.')
  await page.getByRole('button', { name: 'Publicar em en' }).click()
  // F11-T2: the locale's share image is made first
  await expect(page.getByTestId('review-status')).toHaveText('Publicada em en.', { timeout: 60_000 })

  const english = await request.get(`/en/blog/${slug}`)
  expect(english.status()).toBe(200)
  const html = await english.text()
  expect(html).toContain(englishTitle)
  expect(html).toMatch(/<link[^>]+hreflang="pt-BR"/)
  const portugueseSlug = ((await (await request.get(`/api/admin/articles/${id}`)).json()) as { localizations: { locale: string, slug: string }[] }).localizations.find(copy => copy.locale === 'pt-BR')!.slug
  expect(await (await request.get(`/blog/${portugueseSlug}`)).text()).toMatch(new RegExp(`<link[^>]+hreflang="en"[^>]+/en/blog/${slug}|<link[^>]+/en/blog/${slug}[^>]+hreflang="en"`))

  // J-06
  const article = await (await request.get(`/api/admin/articles/${id}`)).json() as { localizations: { locale: string, version: number }[] }
  const version = article.localizations.find(copy => copy.locale === 'pt-BR')!.version
  expect((await request.patch(`/api/admin/articles/${id}`, { headers, data: { version, body: body('Segundo parágrafo, reescrito') } })).status()).toBe(200)
  await page.goto(`/admin/traducoes/article/${id}/en`)
  await hydrated(page)
  await expect(page.locator('[data-testid="review-segment"][data-status="outdated"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="review-segment"][data-status="outdated"]')).toContainText('Segundo parágrafo, reescrito')
  await page.getByRole('button', { name: 'Retraduzir 1 trecho pendente' }).click()
  await page.getByRole('button', { name: 'Confirmar e traduzir' }).click()
  await expect(page.getByTestId('review-status')).toHaveText('Tradução pronta para revisão.')
  await expect(page.locator('[data-testid="review-segment"][data-status="outdated"]')).toHaveCount(0)
  await expect(segments.nth(3).getByLabel('Tradução (en)')).toHaveValue('[en] Segundo parágrafo, reescrito')
  // The title the reviewer wrote stays
  await expect(segments.first().getByLabel('Tradução (en)')).toHaveValue(englishTitle)
  await page.getByRole('button', { name: 'Aprovar tradução' }).click()
  await expect(page.getByTestId('review-status')).toHaveText('Tradução aprovada.')
})
