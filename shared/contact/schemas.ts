// Contact form (F08-T3): one schema shared by the public form (inline errors) and the server, which is the one that
// decides. `website` is the honeypot: hidden from people, filled by bots; a filled one is accepted and dropped
import { z } from 'zod'
import { CONTACT_STATUSES, LOCALES } from '../types/enums.ts'
import { CONTACT_LIMITS } from './limits.ts'

export { CONTACT_LIMITS } from './limits.ts'
export type { ContactField } from './limits.ts'

export const contactSubmissionSchema = z.strictObject({
  name: z.string().trim().min(1, 'required').max(CONTACT_LIMITS.name, 'too_long'),
  email: z.string().trim().min(1, 'required').max(CONTACT_LIMITS.email, 'too_long').pipe(z.email('invalid_email')),
  message: z.string().trim().min(CONTACT_LIMITS.messageMin, 'too_short').max(CONTACT_LIMITS.messageMax, 'too_long'),
  locale: z.enum(LOCALES),
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
})

export type ContactSubmission = z.output<typeof contactSubmissionSchema>

export const contactListQuerySchema = z.strictObject({
  status: z.enum(CONTACT_STATUSES).optional(),
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** The inbox moves a message between states; `new` only comes from the form */
export const contactStatusSchema = z.strictObject({ status: z.enum(['read', 'archived', 'spam']) })
