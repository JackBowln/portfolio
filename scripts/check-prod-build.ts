// pnpm check:prod-build — the production build ships no test-only code (F12-T3, security-model, ADR-0013): the test
// login (TEST_AUTH, server/api/_test/session.post.ts), the other /api/_test routes, the GitHub mock and the test
// pages. They are left out by nuxt.config's `ignore` unless PORTFOLIO_TEST_BUILD=1; this proves it on the output,
// looking for strings that only that code contains. Run it after `pnpm build` (never after the test build, which
// must fail it)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const OUTPUT = '.output'
const MARKERS = [
  '/api/_test/', // every test route, as Nitro registers it
  'test-auth', // the Better Auth plugin of the test login
  'TEST_AUTH user', // the users it creates
  'blog-fixture@example.test', // the content fixture
  'reset-auth', // the route that empties the auth tables
  'code=gh-', // the GitHub OAuth mock
  '_test/server-error', // the test pages
] as const

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const textFiles = files(OUTPUT).filter(path => /\.(m?js|json|html|css|map)$/.test(path))
if (textFiles.length === 0) {
  console.error(`check:prod-build: no build output in ${OUTPUT}; run pnpm build first`)
  process.exit(1)
}
const found = textFiles.flatMap((path) => {
  const text = readFileSync(path, 'utf8')
  return MARKERS.filter(marker => text.includes(marker)).map(marker => `${path}: ${marker}`)
})
if (found.length > 0) {
  console.error(`check:prod-build: test-only code in the build output:\n${found.join('\n')}`)
  process.exit(1)
}
console.log(`check:prod-build: ${textFiles.length} files in ${OUTPUT}, no test-only code`)
