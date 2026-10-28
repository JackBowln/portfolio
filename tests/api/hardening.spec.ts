// F03-T4: CSP by hash, headers per route type, origin/type/size checks on mutations and rate limits (ADR-0012)
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'

const ORIGIN = { origin: SITE_ORIGIN }
const HTML = { 'accept': 'text/html', 'sec-fetch-mode': 'navigate' }
const JSON_BODY = { ...ORIGIN, 'content-type': 'application/json' }

/** A fresh IP per run: the local rate limit counters outlive a single run, and other specs share 127.0.0.1 */
function testIp(): string {
  return `2001:db8::${crypto.randomUUID().slice(0, 4)}:${crypto.randomUUID().slice(0, 4)}`
}

/** Independent of server/utils/csp.ts: the executable inline scripts of a page, hashed as the browser does */
function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs = '']) => !/\ssrc=/.test(attrs) && !/type="application\/(ld\+)?json"/.test(attrs))
    .map(([, , content = '']) => `'sha256-${createHash('sha256').update(content).digest('base64')}'`)
}

function directive(policy: string | undefined, name: string): string {
  return policy?.split('; ').find(part => part.startsWith(`${name} `)) ?? ''
}

test.describe('content security policy', () => {
  for (const path of ['/', '/en/about', '/admin/login', '/does-not-exist']) {
    test(`${path} allows exactly its own inline scripts`, async ({ request }) => {
      const response = await request.get(path, { headers: HTML })
      const policy = response.headers()['content-security-policy']
      const scriptSrc = directive(policy, 'script-src')
      const hashes = inlineScriptHashes(await response.text())

      // Theme, fonts, Nuxt config and the import map
      expect(hashes.length).toBeGreaterThanOrEqual(4)
      for (const hash of hashes) {
        expect(scriptSrc).toContain(hash)
      }
      expect(scriptSrc).toMatch(/^script-src 'self'( 'sha256-[A-Za-z0-9+/]+=*')+$/)
      expect(policy).not.toContain('unsafe-eval')
      expect(policy).toContain(`object-src 'none'`)
      expect(policy).toContain(`base-uri 'none'`)
      expect(policy).toContain(`frame-ancestors 'none'`)
      // The test preview runs on http://localhost
      expect(policy).not.toContain('upgrade-insecure-requests')
    })
  }

  test('the policy is stable for the same page, so it caches with the HTML', async ({ request }) => {
    const first = await request.get('/', { headers: HTML })
    const second = await request.get('/', { headers: HTML })
    expect(first.headers()['content-security-policy']).toBe(second.headers()['content-security-policy'])
  })

  test('JSON responses load nothing and cannot be framed', async ({ request }) => {
    for (const path of ['/api/health', '/api/auth/get-session']) {
      const response = await request.get(path)
      expect(response.headers()['content-security-policy'], path).toBe(`default-src 'none'; frame-ancestors 'none'`)
    }
  })

  test('static assets are never sniffed', async ({ request }) => {
    const html = await (await request.get('/', { headers: HTML })).text()
    const script = html.match(/src="(\/_nuxt\/[^"]+\.js)"/)?.[1]
    expect(script).toBeTruthy()
    const response = await request.get(script!)
    expect(response.status()).toBe(200)
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
  })
})

test.describe('state-changing requests', () => {
  test('from another site are refused before anything else runs', async ({ request }) => {
    const cases: [string, Record<string, string>][] = [
      ['/api/admin/_test/authz', { 'origin': 'https://evil.example', 'content-type': 'application/json' }],
      ['/api/admin/_test/authz', { 'content-type': 'application/json' }],
      ['/api/admin/_test/authz', { 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' }],
      ['/api/auth/sign-out', { 'origin': 'null', 'content-type': 'application/json' }],
      ['/api/setup', { 'origin': 'http://localhost:8787.evil.example', 'content-type': 'application/json' }],
    ]
    for (const [path, headers] of cases) {
      // 403 and not 401 on the admin route: the origin check runs before the session middleware
      const response = await request.post(path, { headers, data: '{}' })
      expect(response.status(), `${path} ${JSON.stringify(headers)}`).toBe(403)
    }
  })

  test('same-origin requests without Origin pass on Sec-Fetch-Site', async ({ request }) => {
    const response = await request.post('/api/admin/_test/authz', {
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      data: '{}',
    })
    // Past the origin check, the session middleware answers
    expect(response.status()).toBe(401)
  })

  test('JSON routes refuse other content types, a form included', async ({ request }) => {
    for (const path of ['/api/admin/_test/authz', '/api/setup']) {
      const form = await request.post(path, { headers: ORIGIN, form: { token: 'x' } })
      expect(form.status(), path).toBe(415)
      const text = await request.post(path, { headers: { ...ORIGIN, 'content-type': 'text/plain' }, data: '{}' })
      expect(text.status(), path).toBe(415)
    }
  })

  test('bodies over 1 MB are refused on every API, Better Auth included', async ({ request }) => {
    const data = JSON.stringify({ name: 'x'.repeat(1_100_000) })
    for (const path of ['/api/admin/_test/authz', '/api/auth/sign-out', '/api/setup']) {
      const response = await request.post(path, { headers: JSON_BODY, data })
      expect(response.status(), path).toBe(413)
    }
  })
})

test.describe('rate limits', () => {
  async function signOut(request: APIRequestContext, ip: string) {
    return request.post('/api/auth/sign-out', { headers: { ...JSON_BODY, 'cf-connecting-ip': ip }, data: '{}' })
  }

  test('sign-in routes allow 10 per minute per IP, then 429 with Retry-After', async ({ request }) => {
    const ip = testIp()
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect((await signOut(request, ip)).status(), `attempt ${attempt}`).not.toBe(429)
    }
    const limited = await signOut(request, ip)
    expect(limited.status()).toBe(429)
    expect(limited.headers()['retry-after']).toBe('60')
    expect((await limited.json()).data).toEqual({ code: 'rate_limited' })

    // Counted per IP and per route
    expect((await signOut(request, testIp())).status()).not.toBe(429)
    const otherRoute = await request.post('/api/auth/passkey/generate-authenticate-options', { headers: { ...JSON_BODY, 'cf-connecting-ip': ip }, data: '{}' })
    expect(otherRoute.status()).not.toBe(429)
  })

  test('reads like get-session are not limited', async ({ request }) => {
    const ip = testIp()
    for (let attempt = 1; attempt <= 12; attempt++) {
      const response = await request.get('/api/auth/get-session', { headers: { 'cf-connecting-ip': ip } })
      expect(response.status(), `attempt ${attempt}`).toBe(200)
    }
  })

  test('admin APIs allow 120 per minute per session', async ({ playwright, baseURL }) => {
    const session = await playwright.request.newContext({ baseURL })
    // TEST_AUTH route: exists only in the test build
    expect((await session.post('/api/_test/session?role=viewer', { headers: ORIGIN })).status()).toBe(200)
    const call = () => session.post('/api/admin/_test/authz', { headers: ORIGIN, data: { resource: 'article', action: 'read' } })

    for (let attempt = 1; attempt <= 120; attempt++) {
      expect((await call()).status(), `attempt ${attempt}`).toBe(200)
    }
    const limited = await call()
    expect(limited.status()).toBe(429)
    expect(limited.headers()['retry-after']).toBe('60')
    await session.dispose()
  })
})
