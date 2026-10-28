import type { Db } from '../../db/client.ts'
import { auditLog } from '../../db/schema/system.ts'

export type AuditRow = typeof auditLog.$inferInsert

export async function insertAuditEntry(db: Db, entry: AuditRow): Promise<void> {
  await db.insert(auditLog).values(entry)
}
