// node scripts/ops/backup.ts --env preview|production — the weekly backup (F12-T4, ADR-0014 §5), run by
// .github/workflows/backup.yml: D1 export and media manifest to the private R2 bucket portfolio-backups, the run of 12
// weeks ago removed, and each upload read back and compared by SHA-256. Remote only, by design: it is the owner's
// workflow (or a run they authorized)
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { BACKUP_BUCKET, backupKeys, mediaManifest } from './backups.ts'
import type { MediaRow, TrackRow } from './backups.ts'
import { DATABASES, d1Query, wrangler } from './wrangler.ts'

const { values } = parseArgs({ options: { env: { type: 'string' } } })
const environment = values.env ?? ''
const database = DATABASES[environment]
if (!database) {
  throw new Error('--env must be preview or production')
}
const where = ['--remote', '--env', environment, '--config', 'wrangler.jsonc']
const keys = backupKeys(environment, new Date())
const dir = mkdtempSync(join(tmpdir(), 'portfolio-backup-'))
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

const started = Date.now()
// Schema first, then the data: a single export follows sqlite_master, where a table rebuilt by a migration comes after
// the tables that reference it, and D1 (foreign keys on) refuses those rows on import. Found in the F12-T4 rehearsal
const schema = join(dir, 'schema.sql')
const data = join(dir, 'data.sql')
wrangler(['d1', 'export', database, ...where, '--no-data', '--output', schema])
wrangler(['d1', 'export', database, ...where, '--no-schema', '--output', data])
const dump = join(dir, 'database.sql')
writeFileSync(dump, Buffer.concat([readFileSync(schema), readFileSync(data)]))

const media = d1Query<MediaRow>(database, where, 'SELECT id, kind, sha256, size_bytes, original_key, variants FROM media WHERE status != \'deleted\'')
const tracks = d1Query<TrackRow>(database, where, 'SELECT media_id, key, size FROM media_tracks')
const manifest = join(dir, 'manifest.json')
writeFileSync(manifest, `${JSON.stringify(mediaManifest(environment, new Date(), media, tracks), null, 2)}\n`)

for (const [key, file, type] of [[keys.database, dump, 'application/sql'], [keys.manifest, manifest, 'application/json']] as const) {
  wrangler(['r2', 'object', 'put', `${BACKUP_BUCKET}/${key}`, '--file', file, '--content-type', type, '--remote'])
  // Read it back: the upload is checked, not assumed
  const copy = join(dir, 'check')
  wrangler(['r2', 'object', 'get', `${BACKUP_BUCKET}/${key}`, '--file', copy, '--remote'])
  if (sha(copy) !== sha(file)) {
    throw new Error(`${key}: the stored copy differs from the upload`)
  }
  console.log(`stored ${BACKUP_BUCKET}/${key} (${readFileSync(file).byteLength} bytes, sha256 ${sha(file).slice(0, 16)}…)`)
}

for (const key of [keys.expiredDatabase, keys.expiredManifest]) {
  try {
    wrangler(['r2', 'object', 'delete', `${BACKUP_BUCKET}/${key}`, '--remote'], { quiet: true })
    console.log(`pruned ${BACKUP_BUCKET}/${key}, if it existed (12 weeks old)`)
  }
  catch {
    // Nothing that old yet
  }
}
console.log(`backup of ${environment}: ${media.length} media items in the manifest, ${((Date.now() - started) / 1000).toFixed(1)} s`)
