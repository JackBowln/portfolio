// Queries the auth policies need beyond what Better Auth's adapter offers
import { and, count, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.ts'
import { accounts, passkeys, users } from '../../db/schema/auth.ts'

export async function ownerExists(db: Db): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'owner')).limit(1)
  return row !== undefined
}

export async function countPasskeys(db: Db, userId: string): Promise<number> {
  const [row] = await db.select({ total: count() }).from(passkeys).where(eq(passkeys.userId, userId))
  return row?.total ?? 0
}

export async function hasLinkedAccount(db: Db, userId: string, providerId: string): Promise<boolean> {
  const [row] = await db.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, providerId))).limit(1)
  return row !== undefined
}
