// Test layers from docs/quality/test-strategy.md (ADR-0015): unit, nuxt and workers in one Vitest run
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // `pnpm test:coverage`: the document schema and its HAST allowlist are the XSS boundary (F05-T2)
    coverage: {
      provider: 'v8',
      include: ['shared/content/**'],
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'reports/coverage',
      thresholds: {
        'shared/content/document-schema.ts': { branches: 90 },
        'shared/content/hast.ts': { branches: 90 },
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.test.ts'],
          environment: 'nuxt',
        },
      }),
      {
        // remoteBindings off: tests never reach Cloudflare (ADR-0013 §9); AI stays unavailable here.
        // Migrations are read here and applied inside workerd by tests/workers/setup.ts
        plugins: [cloudflareTest({
          wrangler: { configPath: './wrangler.jsonc' },
          remoteBindings: false,
          miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations('./server/db/migrations') } },
        })],
        test: {
          name: 'workers',
          include: ['tests/workers/**/*.test.ts'],
          setupFiles: ['./tests/workers/setup.ts'],
        },
      },
    ],
  },
})
