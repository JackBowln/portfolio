// Accessibility checks for dev-only pages (the F01-T1 styleguide), which do not exist in the production build
import { defineConfig, devices } from '@playwright/test'

const DEV_URL = 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/a11y-dev',
  reporter: [['list']],
  use: {
    baseURL: DEV_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev --port 3000',
    url: `${DEV_URL}/api/health`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'a11y-dev', use: { ...devices['Desktop Chrome'] } },
  ],
})
