// A user's own sessions (RF-03.5). Never selects the token: it is the credential itself
import { and, desc, eq, gt } from 'drizzle-orm'
import type { Db } from '../../db/client.ts'
import { sessions } from '../../db/schema/auth.ts'

export interface SessionRow {
  id: string
  userAgent: string | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

export async function listActiveSessions(db: Db, userId: string, now: Date): Promise<SessionRow[]> {
  return db.select({
    id: sessions.id,
    userAgent: sessions.userAgent,
    createdAt: sessions.createdAt,
    updatedAt: sessions.updatedAt,
    expiresAt: sessions.expiresAt,
  }).from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.updatedAt))
}

/** Deletes the session only when it belongs to the user; true when one was deleted */
export async function deleteUserSession(db: Db, userId: string, sessionId: string): Promise<boolean> {
  const deleted = await db.delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id })
  return deleted.length > 0
}
