// Contact messages (F08-T3, data-model §6). The inbox reads newest first by id (uuidv7, time-ordered), one page at
// a time; deleting removes the row for good, and the retention removes what is older than 12 months
import { and, desc, eq, lt, sql } from 'drizzle-orm'
import type { ContactStatus } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { contactMessages } from '../../db/schema/system.ts'

export type ContactMessageRow = typeof contactMessages.$inferSelect

export async function insertContactMessage(db: Db, message: typeof contactMessages.$inferInsert): Promise<void> {
  await db.insert(contactMessages).values(message)
}

export async function listContactMessages(db: Db, filters: { status?: ContactStatus | undefined, before?: string | undefined }, limit: number): Promise<ContactMessageRow[]> {
  return db.select().from(contactMessages)
    .where(and(
      filters.status ? eq(contactMessages.status, filters.status) : undefined,
      filters.before ? lt(contactMessages.id, filters.before) : undefined,
    ))
    .orderBy(desc(contactMessages.id))
    .limit(limit)
}

export async function countNewContactMessages(db: Db): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(contactMessages).where(eq(contactMessages.status, 'new'))
  return row?.count ?? 0
}

export async function findContactMessage(db: Db, id: string): Promise<ContactMessageRow | undefined> {
  const [row] = await db.select().from(contactMessages).where(eq(contactMessages.id, id))
  return row
}

/** Opening a new message marks it read; any other state stays */
export async function markContactMessageRead(db: Db, id: string, now: Date): Promise<void> {
  await db.update(contactMessages).set({ status: 'read', readAt: now }).where(and(eq(contactMessages.id, id), eq(contactMessages.status, 'new')))
}

export async function setContactMessageStatus(db: Db, id: string, status: ContactStatus, now: Date): Promise<ContactMessageRow | undefined> {
  const [row] = await db.update(contactMessages)
    .set({ status, readAt: sql`coalesce(${contactMessages.readAt}, ${now.getTime()})` })
    .where(eq(contactMessages.id, id))
    .returning()
  return row
}

export async function deleteContactMessage(db: Db, id: string): Promise<boolean> {
  const rows = await db.delete(contactMessages).where(eq(contactMessages.id, id)).returning({ id: contactMessages.id })
  return rows.length > 0
}

/** Deletes up to `limit` messages created before the cutoff; returns how many */
export async function deleteContactMessagesBefore(db: Db, cutoff: Date, limit: number): Promise<number> {
  const result = await db.run(sql`
    DELETE FROM ${contactMessages} WHERE id IN (
      SELECT id FROM ${contactMessages} WHERE created_at < ${cutoff.getTime()} LIMIT ${limit}
    )`)
  return result.meta.changes ?? 0
}
