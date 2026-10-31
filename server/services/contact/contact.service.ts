// Contact form and inbox (F08-T3, RF-01.6). A submission is checked in the order of the security model: honeypot,
// Turnstile, then stored with the IP as an HMAC only; the owner's notification goes after the response (waitUntil)
// and its failure never loses the message (decision 2). The inbox changes states and deletes for good (decision 4)
import type { ContactSubmission } from '../../../shared/contact/schemas.ts'
import type { ContactStatus } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { createAppError } from '../../utils/errors.ts'
import { hashIp } from '../../utils/ip-hash.ts'
import { logger } from '../../utils/logger.ts'
import { contactAddress } from '../settings/settings.service.ts'
import type { ContactMessageRow } from './contact.repo.ts'
import {
  countNewContactMessages,
  deleteContactMessage,
  deleteContactMessagesBefore,
  findContactMessage,
  insertContactMessage,
  listContactMessages,
  markContactMessageRead,
  setContactMessageStatus,
} from './contact.repo.ts'
import { contactNotification } from './notify.ts'
import { verifyTurnstile } from './turnstile.ts'

export const CONTACT_RETENTION_MONTHS = 12

export interface ContactDeps {
  turnstileSecret: string | undefined
  ipHashSalt: string | undefined
  from: string
  mailer: SendEmail | undefined
  waitUntil: (promise: Promise<unknown>) => void
  fetcher?: typeof fetch
  /** The site's hostname the token must come from; undefined in local runs (Turnstile's test keys answer example.com) */
  expectedHostname?: string | undefined
  now?: Date
}

/** Stores a message from the public form; returns its id, or null when the honeypot caught a bot */
export async function submitContact(db: Db, input: ContactSubmission, ip: string | null, deps: ContactDeps): Promise<string | null> {
  // Answered like a success, so the bot learns nothing; nothing is stored or sent
  if (input.website) {
    return null
  }
  if (!input.turnstileToken) {
    throw createAppError('bad_request', 'Turnstile required', [{ path: 'turnstileToken', message: 'turnstile' }])
  }
  if (!deps.turnstileSecret) {
    logger.error('contact.turnstile_secret_missing')
    throw createAppError('internal')
  }
  if (!(await verifyTurnstile(deps.turnstileSecret, input.turnstileToken, ip, deps.fetcher, deps.expectedHostname))) {
    throw createAppError('bad_request', 'Turnstile failed', [{ path: 'turnstileToken', message: 'turnstile' }])
  }

  const id = uuidv7()
  const message = { id, name: input.name, email: input.email, message: input.message, locale: input.locale }
  await insertContactMessage(db, { ...message, ipHash: await hashIp(ip, deps.ipHashSalt), createdAt: deps.now ?? new Date() })
  deps.waitUntil(notifyOwner(db, { ...input, id }, deps))
  return id
}

async function notifyOwner(db: Db, message: ContactSubmission & { id: string }, deps: ContactDeps): Promise<void> {
  try {
    const to = await contactAddress(db)
    if (!to || !deps.mailer) {
      logger.warn('contact.notification_skipped', { id: message.id, reason: to ? 'no_binding' : 'no_address' })
      return
    }
    await deps.mailer.send(contactNotification(message, deps.from, to))
    logger.info('contact.notified', { id: message.id })
  }
  catch (error) {
    // The message is stored either way; the log names the failure, never the visitor's data
    logger.error('contact.notification_failed', { id: message.id, error: error instanceof Error ? error.name : 'unknown' })
  }
}

export interface ContactMessageItem {
  id: string
  name: string
  email: string
  message: string
  locale: ContactMessageRow['locale']
  status: ContactStatus
  createdAt: string
  readAt: string | null
}

// Never the IP hash
const toItem = (row: ContactMessageRow): ContactMessageItem => ({
  id: row.id,
  name: row.name,
  email: row.email,
  message: row.message,
  locale: row.locale,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
  readAt: row.readAt?.toISOString() ?? null,
})

export async function listInbox(db: Db, query: { status?: ContactStatus | undefined, cursor?: string | undefined, limit: number }) {
  const [rows, unread] = await Promise.all([
    listContactMessages(db, { status: query.status, before: query.cursor }, query.limit + 1),
    countNewContactMessages(db),
  ])
  const page = rows.slice(0, query.limit)
  return { items: page.map(toItem), nextCursor: rows.length > query.limit ? page.at(-1)?.id ?? null : null, unread }
}

/** One message; opening a new one marks it read */
export async function openContactMessage(db: Db, id: string, now = new Date()): Promise<ContactMessageItem> {
  await markContactMessageRead(db, id, now)
  const row = await findContactMessage(db, id)
  if (!row) {
    throw createAppError('not_found')
  }
  return toItem(row)
}

export async function changeContactStatus(db: Db, id: string, status: ContactStatus, now = new Date()): Promise<ContactMessageItem> {
  const row = await setContactMessageStatus(db, id, status, now)
  if (!row) {
    throw createAppError('not_found')
  }
  return toItem(row)
}

export async function removeContactMessage(db: Db, id: string): Promise<void> {
  if (!(await deleteContactMessage(db, id))) {
    throw createAppError('not_found')
  }
}

/** The cutoff of the retention: the same day and time, 12 months back (UTC) */
export function retentionCutoff(now: Date): Date {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - CONTACT_RETENTION_MONTHS)
  return cutoff
}

export function pruneContactMessages(db: Db, now: Date, limit: number): Promise<number> {
  return deleteContactMessagesBefore(db, retentionCutoff(now), limit)
}
