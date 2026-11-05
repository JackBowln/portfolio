// J-04 (PRD §8; F06-T5, F12-T1): a scheduled publish fires. The cron runs with a moved clock (test-only route), and
// the article reaches its page, the blog list, the RSS and the sitemap, whose cached copies the publish purges
// (tests/api/cache.spec.ts checks the tags meet). Desktop Chromium and a phone (WebKit)
import { expect, test } from '@playwright/test'
import { ORIGIN, unique } from '../../support/journeys'

test('J-04: a scheduled article reaches the page, the list, the RSS and the sitemap when the cron runs', async ({ page }) => {
  const request = page.context().request
  expect((await request.post('/api/_test/session?role=editor', { headers: ORIGIN })).status()).toBe(200)
  const title = `Agendado ${unique()}`
  const created = await request.post('/api/admin/articles', { headers: ORIGIN, data: { title } })
  const { id, localizations } = await created.json() as { id: string, localizations: { slug: string }[] }
  const slug = localizations[0]!.slug
  expect((await request.patch(`/api/admin/articles/${id}`, { headers: ORIGIN, data: { version: 1, excerpt: `Resumo de ${title}` } })).status()).toBe(200)
  const at = new Date(Date.now() + 10 * 60 * 1000)
  expect((await request.post(`/api/admin/articles/${id}/schedule`, { headers: ORIGIN, data: { locale: 'pt-BR', version: 2, at: at.toISOString() } })).status()).toBe(200)
  expect((await page.goto(`/blog/${slug}`))?.status()).toBe(404)

  const run = await request.post('/api/_test/run-task', { headers: ORIGIN, data: { now: new Date(at.getTime() + 60_000).toISOString(), articleIds: [id] } })
  expect((await run.json()).published).toBe(1)
  await page.goto(`/blog/${slug}`)
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await page.goto('/blog')
  await expect(page.getByRole('link', { name: title })).toBeVisible()
  expect(await (await request.get('/rss.xml')).text()).toContain(`<title>${title}</title>`)
  expect(await (await request.get('/sitemap.xml')).text()).toContain(`/blog/${slug}</loc>`)
  // Published ahead by the moved clock, it would top the blog list for a while: off the site again
  expect((await request.post(`/api/admin/articles/${id}/unpublish`, { headers: ORIGIN, data: { locale: 'pt-BR' } })).status()).toBe(200)
})
