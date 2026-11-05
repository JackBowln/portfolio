// A fresh local state for the Playwright suites (F12-T1), run by `pnpm preview:test` before the server starts: the
// test data never piles up between runs (215 projects broke the manual order tests), and `pnpm preview` keeps its
// own .wrangler/state. Only this directory, which only the test server uses, is removed
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'

rmSync('.wrangler/state-e2e', { recursive: true, force: true })
execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--config', 'wrangler.jsonc', '--persist-to', '.wrangler/state-e2e'], { stdio: 'inherit' })
