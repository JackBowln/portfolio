// Contact form (F08-T3, security-model §2): origin and JSON are checked by 00.origin-check; then RL_PUBLIC per IP
// (429), the form switch (404), the fields (422), the honeypot and Turnstile (400). The answer never echoes the input
import { contactSubmissionSchema } from '#shared/contact/schemas'
import { submitContact } from '../../services/contact/contact.service.ts'
import { siteFeatures } from '../../services/settings/settings.service.ts'

export default defineEventHandler(async (event) => {
  const env = useEnv(event)
  const ip = clientIp(event.headers)
  // The key is the raw IP, which stays inside Cloudflare's counter and is never stored by us
  await enforceRateLimit(event, env.RL_PUBLIC, `${ip ?? 'unknown'}:contact`, 'RL_PUBLIC')
  const db = useDb(event)
  if (!(await siteFeatures(db)).contactForm) {
    throw createAppError('not_found')
  }
  const input = await readValidatedFields(event, contactSubmissionSchema)
  await submitContact(db, input, ip, {
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    ipHashSalt: env.IP_HASH_SALT,
    from: env.CONTACT_FROM,
    mailer: env.CONTACT_EMAIL,
    waitUntil: promise => event.waitUntil(promise),
    expectedHostname: env.ENVIRONMENT === 'local' ? undefined : new URL(env.SITE_URL).hostname,
  })
  return { ok: true }
})
