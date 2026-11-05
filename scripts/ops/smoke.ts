// node scripts/ops/smoke.ts --base <url> [--version <x.y.z>] — the post-deploy smoke test (F12-T4, ADR-0014 §3): the
// health check (with the version just deployed, when given), the key pages, the sitemap and robots, the security
// headers and no cookie on a public page. Exit 1 with every failure
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { base: { type: 'string' }, version: { type: 'string' } } })
if (!values.base) {
  throw new Error('--base is required')
}
const base = values.base.replace(/\/$/, '')
const failures: string[] = []
const check = (condition: boolean, message: string) => {
  if (!condition) failures.push(message)
}

const health = await fetch(`${base}/api/health`)
const body = await health.json().catch(() => ({})) as { status?: string, version?: string }
check(health.status === 200 && body.status === 'ok', `/api/health: ${health.status} ${JSON.stringify(body)}`)
if (values.version) {
  check(body.version === values.version, `/api/health: version ${body.version}, expected ${values.version}`)
}

for (const path of ['/', '/blog', '/projetos', '/sobre', '/contato', '/en', '/sitemap.xml', '/robots.txt']) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', headers: { accept: 'text/html' } })
  check(response.status === 200, `${path}: ${response.status}`)
  check(Boolean(response.headers.get('content-security-policy')), `${path}: no Content-Security-Policy`)
  check(response.headers.get('x-content-type-options') === 'nosniff', `${path}: no nosniff`)
  check(!response.headers.get('set-cookie'), `${path}: a public response set a cookie`)
}

if (failures.length > 0) {
  console.error(`smoke failed on ${base}:\n${failures.join('\n')}`)
  process.exit(1)
}
console.log(`smoke passed on ${base}${values.version ? ` (version ${values.version})` : ''}`)
