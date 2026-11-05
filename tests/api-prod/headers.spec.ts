// F12-T3 (ADR-0012, security-model §5): the security headers of the production-like build, on every kind of
// response. Pages: a CSP with script hashes and no inline script, no objects, no base, no framing. Data and files:
// `default-src 'none'`. Everywhere: HSTS, nosniff, no framing, a strict referrer, COOP and a closed Permissions-Policy
import { expect, test } from '@playwright/test'
import type { APIResponse } from '@playwright/test'

const PAGES = ['/', '/sobre', '/admin/login', '/nao-existe']
const DATA = ['/api/public/settings?locale=pt-BR', '/sitemap.xml', '/robots.txt', '/api/health']

function expectBase(response: APIResponse) {
  const headers = response.headers()
  const url = response.url()
  expect(headers['strict-transport-security'], url).toBe('max-age=63072000; includeSubDomains')
  expect(headers['x-content-type-options'], url).toBe('nosniff')
  expect(headers['x-frame-options'], url).toBe('DENY')
  expect(headers['referrer-policy'], url).toBe('strict-origin-when-cross-origin')
  expect(headers['cross-origin-opener-policy'], url).toBe('same-origin')
  expect(headers['permissions-policy'], url).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=()')
}

const directives = (csp: string) => Object.fromEntries(csp.split(';').map(part => part.trim().split(/\s+/)).map(([name, ...values]) => [name, values]))

test('pages carry a hash-based CSP and the base security headers', async ({ request }) => {
  for (const path of PAGES) {
    const response = await request.get(path, { headers: { accept: 'text/html' } })
    expectBase(response)
    const csp = directives(response.headers()['content-security-policy'] ?? '')
    expect(csp['default-src'], path).toEqual(['\'self\''])
    expect(csp['script-src']?.filter(value => value.startsWith('\'sha256-')).length, path).toBeGreaterThan(0)
    expect(csp['script-src'], path).not.toContain('\'unsafe-inline\'')
    expect(csp['script-src'], path).not.toContain('\'unsafe-eval\'')
    expect(csp['object-src'], path).toEqual(['\'none\''])
    expect(csp['base-uri'], path).toEqual(['\'none\''])
    expect(csp['frame-ancestors'], path).toEqual(['\'none\''])
    expect(csp['form-action'], path).toEqual(['\'self\''])
  }
})

test('data and files load nothing and are never framed', async ({ request }) => {
  for (const path of DATA) {
    const response = await request.get(path)
    expectBase(response)
    expect(response.headers()['content-security-policy'], path).toBe('default-src \'none\'; frame-ancestors \'none\'')
    expect(response.headers()['set-cookie'], path).toBeUndefined()
  }
})
