import { and, desc, eq, gte, lt, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Db } from '../../db/client.ts'
import { users } from '../../db/schema/auth.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { auditLog } from '../../db/schema/system.ts'

export type AuditRow = typeof auditLog.$inferInsert

export async function insertAuditEntry(db: Db, entry: AuditRow): Promise<void> {
  await db.insert(auditLog).values(entry)
}

/**
 * The INSERT of an entry for a caller's batch, written only when `guard` holds, so an action and its audit row
 * commit together or not at all (publishing, F06-T4)
 */
export function auditEntryStatement(db: Db, entry: AuditRow, guard: SQL) {
  const value = <T>(item: unknown, column: string) => sql<T>`${item}`.as(column)
  return db.insert(auditLog).select(db.select({
    id: value<string>(uuidv7(), 'id'),
    actorUserId: value<string | null>(entry.actorUserId ?? null, 'actor_user_id'),
    action: value<string>(entry.action, 'action'),
    entityType: value<string | null>(entry.entityType ?? null, 'entity_type'),
    entityId: value<string | null>(entry.entityId ?? null, 'entity_id'),
    locale: value<string | null>(entry.locale ?? null, 'locale'),
    metadata: value<string | null>(entry.metadata ? JSON.stringify(entry.metadata) : null, 'metadata'),
    ipHash: value<string | null>(entry.ipHash ?? null, 'ip_hash'),
    createdAt: value<number>(Date.now(), 'created_at'),
  } as never).from(sql`(SELECT 1)`).where(guard))
}

export interface AuditFilters {
  from?: Date | undefined
  /** Exclusive */
  to?: Date | undefined
  actorUserId?: string | undefined
  action?: string | undefined
  /** Id of the last entry already shown; ids are UUIDv7, so they sort by time */
  before?: string | undefined
}

/** Newest first, with the actor's name; ip_hash stays out of every read */
export async function listAuditEntries(db: Db, filters: AuditFilters, limit: number) {
  const conditions: SQL[] = []
  if (filters.from) {
    conditions.push(gte(auditLog.createdAt, filters.from))
  }
  if (filters.to) {
    conditions.push(lt(auditLog.createdAt, filters.to))
  }
  if (filters.actorUserId) {
    conditions.push(eq(auditLog.actorUserId, filters.actorUserId))
  }
  if (filters.action) {
    conditions.push(eq(auditLog.action, filters.action))
  }
  if (filters.before) {
    conditions.push(lt(auditLog.id, filters.before))
  }
  return db.select({
    id: auditLog.id,
    createdAt: auditLog.createdAt,
    action: auditLog.action,
    actorUserId: auditLog.actorUserId,
    actorName: users.name,
    entityType: auditLog.entityType,
    entityId: auditLog.entityId,
    metadata: auditLog.metadata,
  }).from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(and(...conditions))
    .orderBy(desc(auditLog.id))
    .limit(limit)
}

/** Everyone who appears in the log, for the actor filter */
export async function listAuditActors(db: Db) {
  return db.selectDistinct({ id: users.id, name: users.name }).from(auditLog)
    .innerJoin(users, eq(users.id, auditLog.actorUserId))
    .orderBy(users.name)
}
