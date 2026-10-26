import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('D1 binding in miniflare', () => {
  it('writes and reads a row in a temporary table', async () => {
    await env.DB.prepare('CREATE TABLE smoke (id INTEGER PRIMARY KEY, value TEXT NOT NULL)').run()
    await env.DB.prepare('INSERT INTO smoke (value) VALUES (?1)').bind('ok').run()

    const value = await env.DB.prepare('SELECT value FROM smoke').first<string>('value')

    expect(value).toBe('ok')
  })
})
