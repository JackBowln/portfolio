// pnpm check:budgets [--budgets performance-budgets.json] [--manifest <client.manifest.mjs>]
// Run after `pnpm build`; exits 1 when a public route exceeds its JS/CSS budget or ships admin/editor chunks.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'
import { evaluateRoute } from './budgets/compute.ts'
import type { Manifest, RouteBudget } from './budgets/compute.ts'

interface BudgetsFile {
  routes: Record<string, RouteBudget>
  forbiddenInPublicRoutes: string[]
  forbiddenContentInPublicRoutes: string[]
}

const { values } = parseArgs({
  options: {
    budgets: { type: 'string', default: 'performance-budgets.json' },
    manifest: { type: 'string', default: 'node_modules/.cache/nuxt/.nuxt/dist/server/client.manifest.mjs' },
    assets: { type: 'string', default: '.output/public/_nuxt' },
  },
})

const budgets = JSON.parse(readFileSync(values.budgets, 'utf8')) as BudgetsFile
const manifest = (await import(pathToFileURL(resolve(values.manifest)).href)).default as Manifest
const gzipBytes = (file: string) => gzipSync(readFileSync(resolve(values.assets, file)), { level: 9 }).length
const content = { read: (file: string) => readFileSync(resolve(values.assets, file), 'utf8'), markers: budgets.forbiddenContentInPublicRoutes }

const reports = Object.entries(budgets.routes).map(([id, budget]) =>
  evaluateRoute(id, budget, manifest, gzipBytes, budgets.forbiddenInPublicRoutes, content))

const kb = (value: number) => value.toFixed(2).padStart(7)
console.log(`Budgets: ${values.budgets}\n`)
console.log('Route  Path                   JS kB / limit       CSS kB / limit      Result')
for (const report of reports) {
  const forbidden = report.forbidden.length > 0 ? `  forbidden: ${report.forbidden.join(', ')}` : ''
  console.log(`${report.id.padEnd(6)} ${report.path.padEnd(22)} ${kb(report.jsKb)} / ${String(report.jsLimit).padEnd(8)} ${kb(report.cssKb)} / ${String(report.cssLimit).padEnd(8)} ${report.ok ? 'ok' : 'FAIL'}${forbidden}`)
}

const failed = reports.filter(report => !report.ok)
if (failed.length > 0) {
  console.error(`\n${failed.length} route(s) over budget: ${failed.map(report => report.id).join(', ')}`)
  process.exit(1)
}
