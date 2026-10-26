import { deleteBucketProbe, dropDbProbe, readBucketProbe, readDbProbe, writeBucketProbe, writeDbProbe } from './bindings.repo'

export interface ProbeResult {
  ok: boolean
  read: string | null
}

export interface BindingsDiagnostic {
  written: string
  d1: ProbeResult
  r2: ProbeResult
}

/** Writes a value to D1 and R2, reads it back and cleans up */
export async function runBindingsDiagnostic(db: D1Database, bucket: R2Bucket, value: string): Promise<BindingsDiagnostic> {
  await writeDbProbe(db, value)
  const fromDb = await readDbProbe(db)
  await dropDbProbe(db)

  await writeBucketProbe(bucket, value)
  const fromBucket = await readBucketProbe(bucket)
  await deleteBucketProbe(bucket)

  return {
    written: value,
    d1: { ok: fromDb === value, read: fromDb },
    r2: { ok: fromBucket === value, read: fromBucket },
  }
}
