// The pure parts of the operations scripts (F12-T4, ADR-0014 §5): backup keys and their 12-week retention, the media
// manifest built from the D1 rows (keys, sizes and hashes: the R2 keys are content addressed, so the manifest is the
// list to check a copy against) and the comparison of a restored database with its source. Unit-tested
export const BACKUP_BUCKET = 'portfolio-backups'
export const RETENTION_WEEKS = 12

const day = (date: Date) => date.toISOString().slice(0, 10)

/** Keys of this run's files and of the run that leaves the retention window */
export function backupKeys(environment: string, now: Date) {
  const expired = new Date(now.getTime() - RETENTION_WEEKS * 7 * 24 * 3600 * 1000)
  return {
    database: `d1/${environment}/${day(now)}.sql`,
    manifest: `media/${environment}/manifest-${day(now)}.json`,
    expiredDatabase: `d1/${environment}/${day(expired)}.sql`,
    expiredManifest: `media/${environment}/manifest-${day(expired)}.json`,
  }
}

export interface MediaRow {
  id: string
  kind: string
  sha256: string
  size_bytes: number
  original_key: string
  variants: string | { key: string, size: number }[]
}

export interface TrackRow {
  media_id: string
  key: string
  size: number
}

/** Every stored object of the library: originals, variants and tracks, with the sizes D1 recorded */
export function mediaManifest(environment: string, now: Date, media: readonly MediaRow[], tracks: readonly TrackRow[]) {
  const items = media.map((row) => {
    const variants = typeof row.variants === 'string' ? JSON.parse(row.variants) as { key: string, size: number }[] : row.variants
    return {
      id: row.id,
      kind: row.kind,
      sha256: row.sha256,
      objects: [
        { key: row.original_key, size: row.size_bytes },
        ...variants.map(variant => ({ key: variant.key, size: variant.size })),
        ...tracks.filter(track => track.media_id === row.id).map(track => ({ key: track.key, size: track.size })),
      ],
    }
  })
  const objects = items.flatMap(item => item.objects)
  return { environment, generatedAt: now.toISOString(), items: items.length, objects: objects.length, bytes: objects.reduce((sum, object) => sum + object.size, 0), media: items }
}

export interface TableSnapshot {
  /** Rows per table */
  counts: Record<string, number>
  /** A few rows per table, as JSON, for a spot check */
  samples: Record<string, string[]>
}

/** What differs between the source and the restored copy; empty when they match */
export function compareSnapshots(source: TableSnapshot, restored: TableSnapshot): string[] {
  const problems: string[] = []
  for (const [table, count] of Object.entries(source.counts)) {
    if (!(table in restored.counts)) {
      problems.push(`${table}: missing in the restored copy`)
    }
    else if (restored.counts[table] !== count) {
      problems.push(`${table}: ${count} rows in the source, ${restored.counts[table]} restored`)
    }
  }
  for (const [table, rows] of Object.entries(source.samples)) {
    const copy = new Set(restored.samples[table] ?? [])
    const lost = rows.filter(row => !copy.has(row))
    if (lost.length > 0) {
      problems.push(`${table}: ${lost.length} sampled rows differ`)
    }
  }
  return problems
}
