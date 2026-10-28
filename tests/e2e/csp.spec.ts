// F03-T4: the CSP blocks nothing the site itself ships (ADR-0012 §1, risk "a new inline script breaks the CSP").
// Every violation is recorded from the first byte, before any page script runs
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const ROUTES = [
  '/',
  '/en',
  '/es',
  '/de',
  '/fr',
  '/sobre',
  '/en/about',
  '/blog/x',
  '/de/blog/x',
  '/does-not-exist',
  '/admin/login',
  '/admin/conta/passkeys',
]

async function watchViolations(page: Page): Promise<string[]> {
  const violations: string[] = []
  await page.exposeFunction('__reportCspViolation', (entry: string) => violations.push(entry))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { __reportCspViolation: (entry: string) => void }).__reportCspViolation
      report(`${event.effectiveDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`)
    })
  })
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      violations.push(message.text())
    }
  })
  return violations
}

for (const path of ROUTES) {
  test(`${path} runs without CSP violations`, async ({ page }) => {
    const violations = await watchViolations(page)
    const response = await page.goto(path)
    expect(response?.headers()['content-security-policy']).toContain('script-src')
    await page.waitForLoadState('networkidle')
    expect(violations).toEqual([])
    // Mounted: the inline config script and the entry module both ran
    await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
  })
}
