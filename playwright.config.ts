// Playwright against the production build running in `wrangler dev` (ADR-0013, docs/quality/test-strategy.md)
import { defineConfig, devices } from '@playwright/test'

const PREVIEW_URL = 'http://localhost:8787'
const PROD_LIKE_URL = 'http://localhost:8788'

export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: PREVIEW_URL,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // CI builds in an earlier step; locally the suite builds first, with the test-only routes (server/api/_test)
      command: process.env.CI ? 'pnpm preview:test' : 'pnpm build && pnpm preview:test',
      env: { PORTFOLIO_TEST_BUILD: '1' },
      url: `${PREVIEW_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // Same build with ENVIRONMENT=production (indexable robots, HSTS); started after the first one has built
      command: 'pnpm preview:prod',
      url: `${PROD_LIKE_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'api-prod', testDir: './tests/api-prod', use: { baseURL: PROD_LIKE_URL } },
    { name: 'e2e', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'] } },
    { name: 'e2e-mobile', testDir: './tests/e2e', use: { ...devices['iPhone 15'] } },
    { name: 'a11y', testDir: './tests/a11y', use: { ...devices['Desktop Chrome'] } },
    // Owner bootstrap and login (F03-T2): it empties the auth tables first, so it runs alone after everything else
    {
      name: 'auth-flow',
      testDir: './tests/auth-flow',
      dependencies: ['api', 'api-prod', 'e2e', 'e2e-mobile', 'a11y'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
