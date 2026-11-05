// F06-T5: the public blog in a browser. List → article → another language; an article published only in pt-BR offers
// no broken link in the switcher; pages of a topic; the article reads fully without JS. J-04 is in
// tests/e2e/journeys (F12-T1)
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { ensureBlogFixture } from '../support/blog'

const ORIGIN = { origin: SITE_ORIGIN }
const unique = () => randomBytes(4).toString('hex')

async function editor(request: APIRequestContext) {
  expect((await request.post('/api/_test/session?role=editor', { headers: ORIGIN })).status()).toBe(200)
}

async function draft(request: APIRequestContext, title: string, tagIds: string[] = []): Promise<{ id: string, slug: string }> {
  const created = await request.post('/api/admin/articles', { headers: ORIGIN, data: { title } })
  expect(created.status()).toBe(201)
  const { id, localizations } = await created.json() as { id: string, localizations: { slug: string }[] }
  expect((await request.patch(`/api/admin/articles/${id}`, { headers: ORIGIN, data: { version: 1, excerpt: `Resumo de ${title}`, tagIds } })).status()).toBe(200)
  return { id, slug: localizations[0]!.slug }
}

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('list → article → the same article in German', async ({ page }) => {
  await page.goto('/blog')
  await expect(page.getByRole('heading', { level: 1, name: 'Blog' })).toBeVisible()
  // A click during hydration can be lost on a slow (mobile) run
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
  // Other specs publish articles in parallel, so the fixture's own topic is the stable list
  await page.getByRole('navigation', { name: 'Temas do blog' }).getByRole('link', { name: /^x/ }).click()
  await expect(page).toHaveURL(/\/blog\/temas\/x$/)
  await page.getByRole('link', { name: 'Artigo de exemplo [PLACEHOLDER]' }).first().click()
  await expect(page).toHaveURL(/\/blog\/x$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Artigo de exemplo [PLACEHOLDER]' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Neste artigo' }).getByRole('link', { name: 'Primeira seção' })).toHaveAttribute('href', /#/)
  await expect(page.getByRole('navigation', { name: 'Temas do artigo' }).getByRole('link', { name: 'x' })).toHaveAttribute('href', '/blog/temas/x')

  await page.getByRole('link', { name: 'Deutsch' }).click()
  await expect(page).toHaveURL(/\/de\/blog\/x$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('heading', { level: 1, name: 'Example article (de) [PLACEHOLDER]' })).toBeVisible()
  await page.getByRole('link', { name: 'Alle Artikel' }).click()
  await expect(page).toHaveURL(/\/de\/blog$/)
})

test('an article only in pt-BR and a topic: the switcher sends other locales to their blog, never to a 404', async ({ page }) => {
  await editor(page.context().request)
  const title = `Só em português ${unique()}`
  const { id, slug } = await draft(page.context().request, title)
  expect((await page.context().request.post(`/api/admin/articles/${id}/publish`, { headers: ORIGIN, data: { locale: 'pt-BR', version: 2 } })).status()).toBe(200)
  const messages: string[] = []
  page.on('console', message => messages.push(message.text()))
  await page.goto(`/blog/${slug}`)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  // The server's HTML already has the fallback (rewritten after rendering), and hydration agrees with it
  await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/blog')
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
  await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/blog')
  expect(messages.filter(text => /hydrat|mismatch/i.test(text))).toEqual([])
  await page.getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/en\/blog$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  // A page that exists in every locale keeps the equivalent links
  await page.goto('/blog/x')
  await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/blog/x')
  // F11-T3: a topic links its translated versions too (the topic x is named and has an article in every locale)
  await page.goto('/blog/temas/x')
  await expect(page.getByRole('link', { name: 'Deutsch' })).toHaveAttribute('href', '/de/blog/themen/x')
})

test('a topic in pages of 10, with previous and next links', async ({ page }) => {
  const request = page.context().request
  await editor(request)
  const topic = await (await request.post('/api/admin/tags', { headers: ORIGIN, data: { name: `Paginação ${unique()}` } })).json() as { id: string, slug: string }
  for (let index = 0; index < 11; index++) {
    const { id } = await draft(request, `Página ${index} ${unique()}`, [topic.id])
    expect((await request.post(`/api/admin/articles/${id}/publish`, { headers: ORIGIN, data: { locale: 'pt-BR', version: 2 } })).status()).toBe(200)
  }
  await page.goto(`/blog/temas/${topic.slug}`)
  const list = page.getByRole('main').getByRole('article')
  await expect(list).toHaveCount(10)
  const pagination = page.getByRole('navigation', { name: 'Paginação' })
  await expect(pagination).toContainText('Página 1 de 2')
  // A click during hydration can be lost on a slow (mobile) run
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
  await pagination.getByRole('link', { name: 'Próxima página' }).click()
  await expect(page).toHaveURL(new RegExp(`/blog/temas/${topic.slug}\\?page=2$`))
  await expect(list).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/blog/temas/${topic.slug}\\?page=2$`))
  await pagination.getByRole('link', { name: 'Página anterior' }).click()
  await expect(list).toHaveCount(10)
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('the article, its contents and the list read fully', async ({ page }) => {
    await page.goto('/blog/x')
    await expect(page.getByRole('heading', { level: 1, name: 'Artigo de exemplo [PLACEHOLDER]' })).toBeVisible()
    await expect(page.getByText('[PLACEHOLDER] Texto de exemplo do artigo de teste.')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Segunda seção' })).toBeVisible()
    await page.goto('/blog/temas/x')
    await expect(page.getByRole('link', { name: 'Artigo de exemplo [PLACEHOLDER]' })).toBeVisible()
  })
})
