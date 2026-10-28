import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

const tables = async () => (await env.DB.prepare(`select name from sqlite_master where type = 'table'`).all<{ name: string }>()).results.map(row => row.name)
const indexes = async (table: string) => (await env.DB.prepare(`select name from sqlite_master where type = 'index' and tbl_name = ?`).bind(table).all<{ name: string }>()).results.map(row => row.name)

describe('auth migration', () => {
  it('creates the Better Auth tables', async () => {
    expect(await tables()).toEqual(expect.arrayContaining(['users', 'sessions', 'accounts', 'verifications', 'passkeys']))
  })

  it('keeps emails, session tokens and external accounts unique', async () => {
    expect(await indexes('users')).toContain('users_email_unique')
    expect(await indexes('sessions')).toContain('sessions_token_unique')
    expect(await indexes('accounts')).toContain('accounts_provider_account_unique')
    expect(await indexes('passkeys')).toContain('passkeys_credential_id_unique')
  })

  it('defaults new users to the viewer role and cascades deletes', async () => {
    const now = Date.now()
    await env.DB.batch([
      env.DB.prepare(`insert into users (id, name, email, created_at, updated_at) values ('u1', 'n', 'u1@example.test', ?, ?)`).bind(now, now),
      env.DB.prepare(`insert into sessions (id, user_id, token, expires_at, created_at, updated_at) values ('s1', 'u1', 't1', ?, ?, ?)`).bind(now, now, now),
      env.DB.prepare(`insert into accounts (id, user_id, account_id, provider_id, created_at, updated_at) values ('a1', 'u1', '42', 'github', ?, ?)`).bind(now, now),
      env.DB.prepare(`insert into passkeys (id, public_key, user_id, credential_id, counter, device_type, backed_up) values ('p1', 'k', 'u1', 'c1', 0, 'singleDevice', 0)`),
    ])

    expect(await env.DB.prepare(`select role from users where id = 'u1'`).first('role')).toBe('viewer')
    await env.DB.prepare(`delete from users where id = 'u1'`).run()
    expect(await env.DB.prepare(`select count(*) as n from sessions`).first('n')).toBe(0)
    expect(await env.DB.prepare(`select count(*) as n from accounts`).first('n')).toBe(0)
    expect(await env.DB.prepare(`select count(*) as n from passkeys`).first('n')).toBe(0)
  })
})
