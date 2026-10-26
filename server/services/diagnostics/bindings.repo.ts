// Dev-only probes for the local D1 and R2 emulation (F00-T3)
const PROBE_TABLE = '_diagnostics_probe'
const PROBE_KEY = '_diagnostics/probe.txt'

export async function writeDbProbe(db: D1Database, value: string): Promise<void> {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS ${PROBE_TABLE} (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)`),
    db.prepare(`INSERT INTO ${PROBE_TABLE} (id, value) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET value = excluded.value`).bind(value),
  ])
}

export async function readDbProbe(db: D1Database): Promise<string | null> {
  return db.prepare(`SELECT value FROM ${PROBE_TABLE} WHERE id = 1`).first<string>('value')
}

export async function dropDbProbe(db: D1Database): Promise<void> {
  await db.prepare(`DROP TABLE IF EXISTS ${PROBE_TABLE}`).run()
}

export async function writeBucketProbe(bucket: R2Bucket, value: string): Promise<void> {
  await bucket.put(PROBE_KEY, value)
}

export async function readBucketProbe(bucket: R2Bucket): Promise<string | null> {
  const object = await bucket.get(PROBE_KEY)
  return object ? object.text() : null
}

export async function deleteBucketProbe(bucket: R2Bucket): Promise<void> {
  await bucket.delete(PROBE_KEY)
}
