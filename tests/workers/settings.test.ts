import { env } from 'cloudflare:test'
import { eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { auditLog, redirects, siteSettings } from '../../server/db/schema'
import { isUuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)

describe('D1 schema (migration 0000)', () => {
  it('has foreign keys enforced', async () => {
    const pragma = await env.DB.prepare('PRAGMA foreign_keys').first<{ foreign_keys: number }>()

    expect(pragma?.foreign_keys).toBe(1)
  })

  it('writes and reads site_settings with a validated JSON value', async () => {
    await db.insert(siteSettings).values({ key: 'identity', value: { name: '[PLACEHOLDER]', tags: ['a', 'b'] } })

    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, 'identity'))

    expect(row?.value).toEqual({ name: '[PLACEHOLDER]', tags: ['a', 'b'] })
    expect(row?.version).toBe(1)
    expect(row?.updatedAt).toBeInstanceOf(Date)
  })

  it('generates UUIDv7 ids and stores timestamps in milliseconds', async () => {
    const before = Date.now()
    const [entry] = await db.insert(auditLog).values({ action: 'system.test' }).returning()
    const raw = await env.DB.prepare('SELECT created_at FROM audit_log WHERE id = ?1').bind(entry!.id).first<{ created_at: number }>()

    expect(isUuidv7(entry!.id)).toBe(true)
    expect(raw?.created_at).toBeGreaterThanOrEqual(before)
  })

  it('rejects non-JSON metadata before reaching the database', async () => {
    await expect(db.insert(auditLog).values({ action: 'system.test', metadata: { when: new Date() as never } })).rejects.toThrow()
  })

  it('rolls back the whole batch when one statement fails', async () => {
    const batch = db.batch([
      db.insert(redirects).values({ fromPath: '/old', toPath: '/new' }),
      db.insert(redirects).values({ fromPath: '/old', toPath: '/other' }),
    ])

    await expect(batch).rejects.toThrow()
    const [count] = await db.select({ total: sql<number>`count(*)` }).from(redirects)
    expect(count?.total).toBe(0)
  })
})
