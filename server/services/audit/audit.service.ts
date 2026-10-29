// Security-relevant events (ADR-0005 §8): who did what to which entity. Never secrets, tokens or PII in metadata;
// the IP is stored only as an HMAC (ADR-0012 §10), and only when IP_HASH_SALT is set
import type { AuditAction } from '../../../shared/audit/actions.ts'
import type { Db } from '../../db/client.ts'
import { hashIp } from '../../utils/ip-hash.ts'
import { logger } from '../../utils/logger.ts'
import { insertAuditEntry, listAuditActors, listAuditEntries } from './audit.repo.ts'

export { AUDIT_ACTIONS } from '../../../shared/audit/actions.ts'
export type { AuditAction } from '../../../shared/audit/actions.ts'

export interface AuditEvent {
  action: AuditAction
  actorUserId?: string | null
  entityType?: string
  entityId?: string
  metadata?: Record<string, string | number | boolean | null>
  /** Client IP; hashed here and never written in clear */
  ip?: string | null
}

/** Writes the entry; a failure is logged and never breaks the action being audited */
export async function recordAudit(db: Db, event: AuditEvent, ipHashSalt: string | undefined): Promise<void> {
  try {
    await insertAuditEntry(db, {
      action: event.action,
      actorUserId: event.actorUserId ?? null,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      metadata: event.metadata ?? null,
      ipHash: await hashIp(event.ip, ipHashSalt),
    })
  }
  catch (error) {
    logger.error('audit.write_failed', { action: event.action, message: error instanceof Error ? error.message.slice(0, 200) : 'unknown' })
  }
}

export interface AuditQuery {
  /** YYYY-MM-DD, inclusive, in UTC */
  from?: string | undefined
  /** YYYY-MM-DD, inclusive, in UTC */
  to?: string | undefined
  actor?: string | undefined
  action?: string | undefined
  cursor?: string | undefined
  limit: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** One page of the audit log (RF-02.4) plus the actors to filter by */
export async function queryAudit(db: Db, query: AuditQuery) {
  const rows = await listAuditEntries(db, {
    from: query.from ? new Date(`${query.from}T00:00:00Z`) : undefined,
    to: query.to ? new Date(new Date(`${query.to}T00:00:00Z`).getTime() + DAY_MS) : undefined,
    actorUserId: query.actor,
    action: query.action,
    before: query.cursor,
  }, query.limit + 1)
  const page = rows.slice(0, query.limit)
  return {
    entries: page.map(row => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      action: row.action,
      actor: row.actorUserId ? { id: row.actorUserId, name: row.actorName } : null,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata,
    })),
    nextCursor: rows.length > query.limit ? page.at(-1)?.id ?? null : null,
    actors: await listAuditActors(db),
  }
}
