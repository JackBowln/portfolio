// node scripts/ops/restore-check.ts --source <db> --target <db> [--env preview] [--remote | --local --source-state
// <dir> --target-state <dir>] — compares a restored database with its source (F12-T4, backup-restore §2.2): rows per
// table and three rows of each, by rowid. Exit 1 with what differs. The restore itself is `wrangler d1 execute
// <target> --file <export>.sql`, into a new database, never over the source
import { parseArgs } from 'node:util'
import { compareSnapshots } from './backups.ts'
import type { TableSnapshot } from './backups.ts'
import { d1Query, d1Statements } from './wrangler.ts'

const { values } = parseArgs({
  options: {
    'source': { type: 'string' },
    'target': { type: 'string' },
    'env': { type: 'string' },
    'remote': { type: 'boolean', default: false },
    'local': { type: 'boolean', default: false },
    'source-state': { type: 'string' },
    'target-state': { type: 'string' },
  },
})
if (!values.source || !values.target || values.remote === values.local) {
  throw new Error('usage: --source <db> --target <db> and one of --remote or --local')
}

function where(state: string | undefined): string[] {
  const base = values.remote ? ['--remote'] : ['--local', ...(state ? ['--persist-to', state] : [])]
  return [...base, ...(values.env ? ['--env', values.env] : []), '--config', 'wrangler.jsonc']
}

function snapshot(database: string, state: string | undefined): TableSnapshot {
  const at = where(state)
  const tables = d1Query<{ name: string }>(database, at, 'SELECT name FROM sqlite_master WHERE type = \'table\' AND name NOT LIKE \'sqlite_%\' AND name NOT LIKE \'_cf_%\' ORDER BY name').map(row => row.name)
  if (tables.length === 0) {
    return { counts: {}, samples: {} }
  }
  // Two calls per database, whatever the number of tables: the counts in one, the samples in the other
  const countRows = d1Statements<{ count: number }>(database, at, tables.map(table => `SELECT count(*) AS count FROM "${table}"`))
  const sampleRows = d1Statements<Record<string, unknown>>(database, at, tables.map(table => `SELECT * FROM "${table}" ORDER BY rowid LIMIT 3`))
  const counts: Record<string, number> = {}
  const samples: Record<string, string[]> = {}
  tables.forEach((table, index) => {
    counts[table] = countRows[index]![0]!.count
    samples[table] = sampleRows[index]!.map(row => JSON.stringify(row))
  })
  return { counts, samples }
}

const started = Date.now()
const source = snapshot(values.source, values['source-state'])
const restored = snapshot(values.target, values['target-state'])
const problems = compareSnapshots(source, restored)
const rows = Object.values(source.counts).reduce((sum, count) => sum + count, 0)
console.log(`restore check: ${Object.keys(source.counts).length} tables, ${rows} rows, ${((Date.now() - started) / 1000).toFixed(1)} s`)
for (const [table, count] of Object.entries(source.counts)) {
  console.log(`  ${table.padEnd(32)} ${String(count).padStart(6)} → ${String(restored.counts[table] ?? '—').padStart(6)}`)
}
if (problems.length > 0) {
  console.error(`restore check failed:\n${problems.join('\n')}`)
  process.exit(1)
}
console.log('restore check: counts and samples match')
