// Admin-only. A contact message as the inbox reads it (server/services/contact/contact.service.ts)
import type { ContactStatus, Locale } from '#shared/types/enums'

export interface ContactMessage {
  id: string
  name: string
  email: string
  message: string
  locale: Locale
  status: ContactStatus
  createdAt: string
  readAt: string | null
}

export interface ContactInboxPage {
  items: ContactMessage[]
  nextCursor: string | null
  unread: number
}
