import { expect, test } from '@playwright/test'

test('GET /api/health reports ok without caching or cookies', async ({ request }) => {
  const response = await request.get('/api/health')

  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toBe('no-store')
  expect(response.headers()['set-cookie']).toBeUndefined()
  expect(await response.json()).toEqual({ status: 'ok', version: expect.any(String) })
})

test('dev-only routes do not exist in the production build', async ({ request }) => {
  for (const path of ['/api/_dev/bindings', '/dev/styleguide']) {
    expect((await request.get(path)).status(), path).toBe(404)
  }
})
