// Runs wrangler for the operations scripts (F12-T4), with the project's config; output is returned, never logged
// with secrets (wrangler reads CLOUDFLARE_API_TOKEN from the environment)
import { execFileSync } from 'node:child_process'

export function wrangler(args: readonly string[], options: { quiet?: boolean } = {}): string {
  return execFileSync('pnpm', ['exec', 'wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', options.quiet ? 'pipe' : 'inherit'], maxBuffer: 256 * 1024 * 1024 })
}

/** The rows of each statement, in order, through one `wrangler d1 execute --json` call */
export function d1Statements<T>(database: string, where: readonly string[], statements: readonly string[]): T[][] {
  const output = wrangler(['d1', 'execute', database, ...where, '--json', '--command', statements.join('; ')], { quiet: true })
  const parsed = JSON.parse(output.slice(output.indexOf('['))) as { results: T[] }[]
  return parsed.map(statement => statement.results)
}

/** Rows of one query */
export function d1Query<T>(database: string, where: readonly string[], sql: string): T[] {
  return d1Statements<T>(database, where, [sql]).flat()
}

export const DATABASES: Record<string, string> = { preview: 'portfolio-preview', production: 'portfolio-production' }
