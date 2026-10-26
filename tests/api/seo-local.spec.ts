// F02-T3: outside production nothing is indexable (ADR-0008 §6)
import { expect, test } from '@playwright/test'

test('every response carries X-Robots-Tag: noindex, nofollow', async ({ request }) => {
  for (const path of ['/', '/en/about', '/api/health', '/does-not-exist', '/robots.txt', '/sitemap.xml']) {
    expect((await request.get(path)).headers()['x-robots-tag'], path).toBe('noindex, nofollow')
  }
})

test('robots.txt blocks everything', async ({ request }) => {
  const response = await request.get('/robots.txt')

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('text/plain')
  expect(await response.text()).toBe('User-agent: *\nDisallow: /\n')
})
