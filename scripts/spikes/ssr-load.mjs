// F00-T6 spike: sequential cache-miss requests (unique query per request) against a deployed Worker.
// node scripts/spikes/ssr-load.mjs --base https://portfolio-preview.<sub>.workers.dev --path /spike/article --count 200 --label article
// CPU per request comes from `wrangler tail --format json` (cpuTime), matched by the `spike` query value.
import { appendFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    path: { type: 'string', default: '/' },
    count: { type: 'string', default: '200' },
    label: { type: 'string', default: 'run' },
    out: { type: 'string', default: 'ssr-load.jsonl' },
  },
})
if (!values.base) {
  throw new Error('--base is required')
}

const count = Number(values.count)
const statuses = {}
const cacheStatuses = {}
const durations = []

for (let i = 1; i <= count; i++) {
  const url = `${values.base}${values.path}?spike=${values.label}-${i}`
  const startedAt = performance.now()
  const response = await fetch(url, { headers: { 'user-agent': 'f00-t6-ssr-load' } })
  await response.arrayBuffer()
  const ms = performance.now() - startedAt
  const cache = response.headers.get('cf-cache-status') ?? 'none'
  statuses[response.status] = (statuses[response.status] ?? 0) + 1
  cacheStatuses[cache] = (cacheStatuses[cache] ?? 0) + 1
  durations.push(ms)
  appendFileSync(values.out, `${JSON.stringify({ label: values.label, i, status: response.status, cache, ms: Math.round(ms) })}\n`)
}

const sorted = [...durations].sort((a, b) => a - b)
const at = p => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))])
console.log(JSON.stringify({ label: values.label, path: values.path, count, statuses, cacheStatuses, clientMs: { p50: at(0.5), p95: at(0.95), p99: at(0.99) } }))
