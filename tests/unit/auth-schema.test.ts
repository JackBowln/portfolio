import { passkey } from '@better-auth/passkey'
import { getAuthTables } from 'better-auth/db'
import { admin } from 'better-auth/plugins'
import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { accounts, passkeys, sessions, users, verifications } from '../../server/db/schema/auth'

// The admin plugin is enabled since F03-T3 (server/services/auth/access.ts) and passkey since F03-T2
const tables = getAuthTables({ plugins: [admin(), passkey()] })
const drizzleTables = { user: users, session: sessions, account: accounts, verification: verifications, passkey: passkeys }

describe('auth schema', () => {
  for (const [model, table] of Object.entries(drizzleTables)) {
    it(`${model} has exactly the fields Better Auth expects`, () => {
      const expected = Object.keys(tables[model]?.fields ?? {}).concat('id').sort()
      expect(Object.keys(getTableColumns(table)).sort()).toEqual(expected)
    })
  }

  it('required Better Auth fields are NOT NULL', () => {
    for (const [model, table] of Object.entries(drizzleTables)) {
      const columns = getTableColumns(table) as Record<string, { notNull: boolean }>
      for (const [field, attribute] of Object.entries(tables[model]?.fields ?? {})) {
        if (attribute.required) {
          expect(columns[field]?.notNull, `${model}.${field}`).toBe(true)
        }
      }
    }
  })
})
