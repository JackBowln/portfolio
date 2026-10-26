// F02-T4: cache, security headers and error handling on the production build (routes under _test exist only with
// PORTFOLIO_TEST_BUILD=1, set by playwright.config.ts and CI)
import { expect, test } from '@playwright/test'

const PUBLIC_POLICY = 'public, max-age=0, s-maxage=604800'
const HTML = { 'accept': 'text/html', 'sec-fetch-mode': 'navigate' }

function expectBaseSecurityHeaders(headers: Record<string, string>) {
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['cross-origin-opener-policy']).toBe('same-origin')
  expect(headers['permissions-policy']).toContain('camera=()')
  expect(headers['referrer-policy']).toMatch(/^(strict-origin-when-cross-origin|no-referrer)$/)
  expect(headers['x-powered-by']).toBeUndefined()
  // HSTS only on production; this build runs with ENVIRONMENT=local
  expect(headers['strict-transport-security']).toBeUndefined()
}

test.describe('public pages', () => {
  test('are cached at the edge with the site tag and no cookies', async ({ request }) => {
    for (const method of ['get', 'head'] as const) {
      const response = await request[method]('/', { headers: HTML })
      const headers = response.headers()

      expect(response.status(), method).toBe(200)
      expect(headers['cache-control'], method).toBe(PUBLIC_POLICY)
      expect(headers['cache-tag'], method).toBe('site')
      expect(headers['set-cookie'], method).toBeUndefined()
      expectBaseSecurityHeaders(headers)
    }
  })

  test('keep route tags and lose any Set-Cookie', async ({ request }) => {
    const response = await request.get('/_test/cookie', { headers: HTML })
    const headers = response.headers()

    expect(response.status()).toBe(200)
    expect(headers['cache-control']).toBe(PUBLIC_POLICY)
    expect(headers['cache-tag']).toBe('page:home:pt-BR')
    expect(headers['set-cookie']).toBeUndefined()
  })

  test('not found pages are never stored', async ({ request }) => {
    const response = await request.get('/does-not-exist', { headers: HTML })
    const headers = response.headers()

    expect(response.status()).toBe(404)
    expect(headers['cache-control']).toBe('no-store')
    expect(headers['cache-tag']).toBeUndefined()
    expectBaseSecurityHeaders(headers)
  })
})

test.describe('APIs and admin', () => {
  test('APIs are never stored', async ({ request }) => {
    const response = await request.get('/api/health')

    expect(response.headers()['cache-control']).toBe('no-store')
    expect(response.headers()['cache-tag']).toBeUndefined()
    expectBaseSecurityHeaders(response.headers())
  })

  test('API 404s are not cacheable', async ({ request }) => {
    const response = await request.get('/api/does-not-exist')

    expect(response.status()).toBe(404)
    // Nitro forces no-cache on JSON 404s; Cloudflare does not store no-cache responses either
    expect(response.headers()['cache-control']).toMatch(/^no-(store|cache)$/)
  })

  for (const path of ['/admin', '/admin/settings', '/api/admin/anything']) {
    test(`${path} is private and not indexable`, async ({ request }) => {
      const response = await request.get(path, { headers: HTML })

      expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow')
      expect(response.headers()['cache-control']).not.toContain('public')
      expect(response.headers()['cache-tag']).toBeUndefined()
    })
  }
})

test.describe('errors and validation', () => {
  test('unexpected errors return a generic 500 without internals', async ({ request }) => {
    const response = await request.get('/api/_test/error')
    const body = await response.text()

    expect(response.status()).toBe(500)
    expect(response.headers()['cache-control']).toBe('no-store')
    expect(body).not.toContain('internal detail')
    expect(body).not.toMatch(/at .+\.(m?js|ts):\d+/)
    expect(JSON.parse(body)).toMatchObject({ statusCode: 500, message: 'Server Error' })
  })

  test('valid bodies pass strict validation', async ({ request }) => {
    const response = await request.post('/api/_test/echo', { data: { name: 'ok' } })

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ name: 'ok' })
  })

  test('unknown keys are rejected with field issues', async ({ request }) => {
    const response = await request.post('/api/_test/echo', { data: { name: 'ok', role: 'owner' } })

    expect(response.status()).toBe(400)
    expect((await response.json()).data).toEqual({
      code: 'bad_request',
      issues: [{ path: '', message: expect.stringContaining('role') }],
    })
  })

  test('invalid values are rejected with the field path', async ({ request }) => {
    const response = await request.post('/api/_test/echo', { data: { name: '' } })

    expect(response.status()).toBe(400)
    expect((await response.json()).data.issues).toEqual([{ path: 'name', message: expect.any(String) }])
  })

  test('non-JSON bodies are refused', async ({ request }) => {
    const response = await request.post('/api/_test/echo', { form: { name: 'ok' } })

    expect(response.status()).toBe(415)
  })

  test('bodies over 1 MB are refused before parsing', async ({ request }) => {
    const response = await request.post('/api/_test/echo', {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({ name: 'x'.repeat(1_100_000) }),
    })

    expect(response.status()).toBe(413)
  })
})
