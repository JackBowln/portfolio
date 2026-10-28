// Security-relevant events (ADR-0005 §8): who did what to which entity. Never secrets, tokens or PII in metadata;
// the IP is stored only as a hash, added in F03-T4 (until then ipHash stays null)
import type { Db } from '../../db/client.ts'
import { logger } from '../../utils/logger.ts'
import { insertAuditEntry } from './audit.repo.ts'

export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.github_rejected',
  'auth.bootstrap_rejected',
  'auth.bootstrap_completed',
  'auth.passkey_added',
  'auth.passkey_removed',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface AuditEvent {
  action: AuditAction
  actorUserId?: string | null
  entityType?: string
  entityId?: string
  metadata?: Record<string, string | number | boolean | null>
}

/** Writes the entry; a failure is logged and never breaks the action being audited */
export async function recordAudit(db: Db, event: AuditEvent): Promise<void> {
  try {
    await insertAuditEntry(db, {
      action: event.action,
      actorUserId: event.actorUserId ?? null,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      metadata: event.metadata ?? null,
    })
  }
  catch (error) {
    logger.error('audit.write_failed', { action: event.action, message: error instanceof Error ? error.message.slice(0, 200) : 'unknown' })
  }
}
