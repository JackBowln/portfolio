// Listing and revoking one's own sessions (RF-03.5, ADR-0005 §4). The cookie cache is off, so a deleted session
// fails the very next request. The current session ends through sign-out, not here
import type { Db } from '../../db/client.ts'
import { deleteUserSession, listActiveSessions } from './sessions.repo.ts'

export interface OwnSession {
  id: string
  current: boolean
  userAgent: string | null
  createdAt: string
  lastUsedAt: string
  expiresAt: string
}

export async function listOwnSessions(db: Db, user: { id: string }, currentSessionId: string, now = new Date()): Promise<OwnSession[]> {
  const rows = await listActiveSessions(db, user.id, now)
  return rows.map(row => ({
    id: row.id,
    current: row.id === currentSessionId,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  }))
}

export type RevokeResult = 'revoked' | 'current' | 'not_found'

/** Another user's session id is reported as not found, so ids cannot be probed */
export async function revokeOwnSession(db: Db, user: { id: string }, currentSessionId: string, sessionId: string): Promise<RevokeResult> {
  if (sessionId === currentSessionId) {
    return 'current'
  }
  return (await deleteUserSession(db, user.id, sessionId)) ? 'revoked' : 'not_found'
}
