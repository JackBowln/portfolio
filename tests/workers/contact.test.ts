// F08-T3: the contact form and inbox on a real D1. A submission passes the honeypot and Turnstile (siteverify mocked),
// is stored with the IP only as an HMAC, and notifies the owner after the response; a failed notification keeps the
// message. The inbox moves states and deletes for good; the retention removes what is older than 12 months
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { createDb } from '../../server/db/client'
import { contactMessages, siteSettings } from '../../server/db/schema'
import {
  changeContactStatus,
  listInbox,
  openContactMessage,
  pruneContactMessages,
  removeContactMessage,
  retentionCutoff,
  submitContact,
} from '../../server/services/contact/contact.service'
import type { ContactDeps } from '../../server/services/contact/contact.service'
import { contactNotification } from '../../server/services/contact/notify'
import { verifyTurnstile } from '../../server/services/contact/turnstile'
import { contactSubmissionSchema } from '../../shared/contact/schemas'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
await db.insert(siteSettings).values({ key: 'contact', value: { email: 'owner@example.test', showEmail: false } })
  .onConflictDoUpdate({ target: siteSettings.key, set: { value: { email: 'owner@example.test', showEmail: false } } })

const input = { name: 'Visitante', email: 'visitor@example.test', message: 'Olá, gostaria de conversar.', locale: 'en' as const, turnstileToken: 'token' }
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))
const offline = vi.fn<typeof fetch>(async () => {
  throw new Error('offline')
})
const siteverify = (success: boolean) => vi.fn<typeof fetch>(async () => Response.json({ success }))

function deps(overrides: Partial<ContactDeps> = {}) {
  const pending: Promise<unknown>[] = []
  const mailer = { send: vi.fn(async () => ({ messageId: 'm' })) }
  const value: ContactDeps = {
    turnstileSecret: 'secret',
    ipHashSalt: 'salt-0123456789',
    from: 'contato@localhost.test',
    mailer: mailer as unknown as SendEmail,
    waitUntil: promise => pending.push(promise),
    fetcher: siteverify(true),
    ...overrides,
  }
  return { value, mailer, settled: () => Promise.all(pending) }
}

const stored = (id: string) => db.select().from(contactMessages).where(eq(contactMessages.id, id)).then(rows => rows[0])

describe('contact submission', () => {
  it('validates the fields with the messages the form shows', () => {
    const result = contactSubmissionSchema.safeParse({ name: ' ', email: 'x', message: 'curta', locale: 'en' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map(issue => [issue.path.join('.'), issue.message])).toEqual([['name', 'required'], ['email', 'invalid_email'], ['message', 'too_short']])
    expect(contactSubmissionSchema.safeParse({ ...input, extra: 1 }).success).toBe(false)
  })

  it('stores the message with the IP as an HMAC, never in clear, and notifies the owner after the response', async () => {
    const { value, mailer, settled } = deps()
    const id = await submitContact(db, input, '203.0.113.7', value)
    const row = await stored(id!)
    expect(row).toMatchObject({ name: 'Visitante', email: 'visitor@example.test', locale: 'en', status: 'new' })
    expect(row?.ipHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(row)).not.toContain('203.0.113.7')
    expect(value.fetcher).toHaveBeenCalledOnce()
    expect(String((value.fetcher as ReturnType<typeof siteverify>).mock.calls[0]?.[1]?.body)).toContain('remoteip=203.0.113.7')

    await settled()
    expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.test', replyTo: { name: 'Visitante', email: 'visitor@example.test' } }))
  })

  it('drops a filled honeypot without storing, verifying or sending', async () => {
    const { value, mailer, settled } = deps()
    const before = (await db.select().from(contactMessages)).length
    expect(await submitContact(db, { ...input, website: 'https://spam.example' }, null, value)).toBeNull()
    await settled()
    expect((await db.select().from(contactMessages)).length).toBe(before)
    expect(value.fetcher).not.toHaveBeenCalled()
    expect(mailer.send).not.toHaveBeenCalled()
  })

  it('refuses without a token or with a failed Turnstile (400), and fails closed without the secret', async () => {
    const { turnstileToken: _, ...withoutToken } = input
    expect(await errorOf(submitContact(db, withoutToken, null, deps().value))).toMatchObject({ statusCode: 400, data: { issues: [{ path: 'turnstileToken' }] } })
    expect(await errorOf(submitContact(db, input, null, deps({ fetcher: siteverify(false) }).value))).toMatchObject({ statusCode: 400 })
    expect(await errorOf(submitContact(db, input, null, deps({ fetcher: offline }).value))).toMatchObject({ statusCode: 400 })
    expect(await errorOf(submitContact(db, input, null, deps({ turnstileSecret: undefined }).value))).toMatchObject({ statusCode: 500 })
  })

  it('keeps the message when the notification fails (decision 2)', async () => {
    const { value, mailer, settled } = deps()
    mailer.send.mockRejectedValueOnce(new Error('destination not verified'))
    const id = await submitContact(db, input, null, value)
    await settled()
    expect(await stored(id!)).toBeDefined()
  })

  it('keeps a notification header on one line', () => {
    const mail = contactNotification({ ...input, name: 'Nome\r\nBcc: x@evil.test', id: 'm1' }, 'from@x.test', 'to@x.test')
    expect(mail.subject).not.toMatch(/[\r\n]/)
    expect(mail.replyTo).toMatchObject({ name: 'Nome Bcc: x@evil.test' })
  })

  it('posts the token and the secret to siteverify', async () => {
    const fetcher = siteverify(true)
    expect(await verifyTurnstile('s', 't', null, fetcher)).toBe(true)
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(await verifyTurnstile('s', 't', null, vi.fn<typeof fetch>(async () => new Response('no', { status: 500 })))).toBe(false)
    // Outside local runs the token must come from this site
    const fromSite = vi.fn<typeof fetch>(async () => Response.json({ success: true, hostname: 'example.com' }))
    expect(await verifyTurnstile('s', 't', null, fromSite, 'example.com')).toBe(true)
    expect(await verifyTurnstile('s', 't', null, fromSite, 'portfolio.example')).toBe(false)
  })
})

describe('contact inbox', () => {
  it('lists newest first, opens (marking read), moves states and deletes for good', async () => {
    const { value } = deps()
    const first = await submitContact(db, { ...input, name: 'Primeira' }, null, value)
    const second = await submitContact(db, { ...input, name: 'Segunda' }, null, value)
    const page = await listInbox(db, { status: 'new', limit: 1 })
    expect(page.items[0]).toMatchObject({ id: second, name: 'Segunda' })
    expect(page.items[0]).not.toHaveProperty('ipHash')
    expect(page.nextCursor).toBe(second)
    expect((await listInbox(db, { status: 'new', cursor: page.nextCursor!, limit: 50 })).items.map(item => item.id)).toContain(first)

    const opened = await openContactMessage(db, first!)
    expect(opened).toMatchObject({ status: 'read', readAt: expect.any(String) })
    expect(await changeContactStatus(db, first!, 'spam')).toMatchObject({ status: 'spam', readAt: opened.readAt })
    // Opening again keeps the state
    expect((await openContactMessage(db, first!)).status).toBe('spam')

    await removeContactMessage(db, first!)
    expect(await stored(first!)).toBeUndefined()
    expect(await errorOf(removeContactMessage(db, first!))).toMatchObject({ statusCode: 404 })
    expect(await errorOf(openContactMessage(db, 'missing'))).toMatchObject({ statusCode: 404 })
  })
})

describe('contact retention', () => {
  it('deletes only messages older than 12 months (fake clock)', async () => {
    const now = new Date('2027-11-15T03:01:00Z')
    expect(retentionCutoff(now).toISOString()).toBe('2026-11-15T03:01:00.000Z')
    const old = uuidv7()
    const recent = uuidv7()
    await db.insert(contactMessages).values([
      { name: input.name, email: input.email, message: input.message, locale: input.locale, id: old, createdAt: new Date('2026-10-15T00:00:00Z') },
      { name: input.name, email: input.email, message: input.message, locale: input.locale, id: recent, createdAt: new Date('2026-12-15T00:00:00Z') },
    ])
    const deleted = await pruneContactMessages(db, now, 1000)
    expect(deleted).toBeGreaterThanOrEqual(1)
    expect(await stored(old)).toBeUndefined()
    expect(await stored(recent)).toBeDefined()
  })
})
