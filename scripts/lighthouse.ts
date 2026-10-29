// pnpm lighthouse [--routes R1,E404] [--runs 3] [--devices mobile,desktop] [--base http://localhost:8788] [--assert]
// pnpm lighthouse --path '/_test/media?lcp=…' [--id MEDIA] — one page outside the route table (F04-T3)
// Protocol: docs/quality/performance-budgets.md §2. Serve the production build first (`pnpm build && pnpm preview:prod`):
// the default base runs with ENVIRONMENT=production, since every other environment sends X-Robots-Tag: noindex.
// Chrome: CHROME_PATH or Playwright's Chrome for Testing, so local and CI measure with the same browser.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import type { Flags, Result } from 'lighthouse'

type Device = 'mobile' | 'desktop'

interface BudgetsFile {
  // `lighthouse: false` marks routes Lighthouse cannot audit (non-2xx documents, e.g. the 404 page)
  routes: Record<string, { path: string, lighthouse?: boolean }>
  lighthouse: { minScores: Record<Device, Record<string, number>> }
}

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const
const METRICS = {
  LCP: 'largest-contentful-paint',
  FCP: 'first-contentful-paint',
  TBT: 'total-blocking-time',
  CLS: 'cumulative-layout-shift',
  SI: 'speed-index',
} as const

const budgets = JSON.parse(readFileSync('performance-budgets.json', 'utf8')) as BudgetsFile
const { values } = parseArgs({
  options: {
    routes: { type: 'string', default: Object.entries(budgets.routes).filter(([, route]) => route.lighthouse !== false).map(([id]) => id).join(',') },
    runs: { type: 'string', default: '3' },
    devices: { type: 'string', default: 'mobile,desktop' },
    base: { type: 'string', default: 'http://localhost:8788' },
    assert: { type: 'boolean', default: false },
    path: { type: 'string' },
    id: { type: 'string', default: 'PAGE' },
  },
})

const routes = values.path ? [values.id] : values.routes.split(',')
const devices = values.devices.split(',') as Device[]
const runs = Number(values.runs)
const outDir = join('reports', 'lighthouse', new Date().toISOString().slice(0, 10))
mkdirSync(outDir, { recursive: true })

const median = (numbers: number[]) => {
  const sorted = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] ?? 0 : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

async function audit(url: string, device: Device): Promise<Result> {
  // A fresh Chrome per run: clean profile and no browser cache (performance-budgets §2.4–2.5)
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH ?? chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  })
  try {
    const flags: Flags = { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: [...CATEGORIES] }
    const result = await lighthouse(url, flags, device === 'desktop' ? desktopConfig : undefined)
    if (!result) {
      throw new Error(`Lighthouse returned no result for ${url}`)
    }
    return result
  }
  finally {
    chrome.kill()
  }
}

const startedAt = Date.now()
const rows: string[] = []
const failures: string[] = []
let chromeVersion = ''
let lighthouseVersion = ''

for (const id of routes) {
  const route = values.path ? { path: values.path } : budgets.routes[id]
  if (!route) {
    throw new Error(`Unknown route id ${id} (see performance-budgets.json)`)
  }
  for (const device of devices) {
    const scores: Record<string, number[]> = Object.fromEntries(CATEGORIES.map(category => [category, []]))
    const metrics: Record<string, number[]> = Object.fromEntries(Object.keys(METRICS).map(metric => [metric, []]))
    let lcpElement = ''

    for (let run = 1; run <= runs; run++) {
      const { lhr, report } = await audit(`${values.base}${route.path}`, device)
      const [html, json] = report as string[]
      writeFileSync(join(outDir, `${id}-${device}-${run}.html`), html ?? '')
      writeFileSync(join(outDir, `${id}-${device}-${run}.json`), json ?? '')

      chromeVersion = lhr.environment.hostUserAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? chromeVersion
      lighthouseVersion = lhr.lighthouseVersion
      for (const category of CATEGORIES) {
        scores[category]?.push(Math.round((lhr.categories[category]?.score ?? 0) * 100))
      }
      for (const [metric, auditId] of Object.entries(METRICS)) {
        metrics[metric]?.push(lhr.audits[auditId]?.numericValue ?? 0)
      }
      // Lighthouse 13 reports the LCP element inside the lcp-breakdown insight
      const breakdown = JSON.stringify(lhr.audits['lcp-breakdown-insight']?.details ?? {})
      lcpElement = breakdown.match(/"snippet":"((?:[^"\\]|\\.)*)"/)?.[1] ?? lcpElement
    }

    const summary = CATEGORIES.map((category) => {
      const values = scores[category] ?? []
      const spread = Math.max(...values) - Math.min(...values)
      return `${median(values)}${spread ? ` (±${spread})` : ''}`
    })
    const metricSummary = [
      `${Math.round(median(metrics.LCP ?? []))} ms`,
      `${Math.round(median(metrics.FCP ?? []))} ms`,
      `${Math.round(median(metrics.TBT ?? []))} ms`,
      median(metrics.CLS ?? []).toFixed(3),
      `${Math.round(median(metrics.SI ?? []))} ms`,
    ]
    rows.push(`| ${id} | ${device} | ${summary.join(' | ')} | ${metricSummary.join(' | ')} | ${lcpElement.replace(/\|/g, '\\|')} |`)

    for (const [category, minimum] of Object.entries(budgets.lighthouse.minScores[device])) {
      const value = median(scores[category] ?? [])
      if (value < minimum) {
        failures.push(`${id} ${device} ${category}: ${value} < ${minimum}`)
      }
    }
  }
}

console.log(`Lighthouse ${lighthouseVersion} · Chrome ${chromeVersion} · ${runs} runs (median, ±spread) · ${values.base}`)
console.log('| Route | Device | Perf | A11y | BP | SEO | LCP | FCP | TBT | CLS | SI | LCP element |')
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|')
console.log(rows.join('\n'))
console.log(`\nReports: ${outDir} · total ${((Date.now() - startedAt) / 1000).toFixed(1)} s`)

if (values.assert && failures.length > 0) {
  console.error(`\nBelow policy (performance-budgets §3):\n${failures.join('\n')}`)
  process.exit(1)
}
