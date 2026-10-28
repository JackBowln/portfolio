// Audit entry for the current request (ADR-0012 §10): the actor comes from the admin session and the IP from
// Cloudflare's header, so handlers only say what happened. Services without an event call recordAudit directly
import type { H3Event } from 'h3'
import type { AuditEvent } from '../services/audit/audit.service.ts'
import { recordAudit } from '../services/audit/audit.service.ts'

export function auditRequest(event: H3Event, entry: Omit<AuditEvent, 'ip'>): Promise<void> {
  return recordAudit(useDb(event), {
    actorUserId: event.context.auth?.user.id ?? null,
    ...entry,
    ip: clientIp(event.headers),
  }, useEnv(event).IP_HASH_SALT)
}
