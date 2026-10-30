import { applyD1Migrations, env } from 'cloudflare:test'
import type { D1Migration } from '@cloudflare/vitest-plugin'

// Applied once per test file; storage is isolated per file by the plugin
await applyD1Migrations(env.DB, (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS)

// Services throw through createAppError, which calls Nitro's auto-imported createError; workerd tests run outside
// Nitro, so a stand-in with h3's shape (statusCode, statusMessage, data) is installed here
const scope = globalThis as unknown as { createError?: (input: { statusCode: number, statusMessage: string, data?: unknown }) => Error }
scope.createError ??= input => Object.assign(new Error(input.statusMessage), input)
