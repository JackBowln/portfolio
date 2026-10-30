// Preview links (ADR-0006 §8, F06-T3): `base64url(payload).base64url(HMAC-SHA256(payload))` with the payload
// `{ t, id, l, exp }`, valid for at most 24 h. Stateless: a link works for whoever has it until it expires, and
// rotating PREVIEW_TOKEN_SECRET invalidates every link. Verification returns null for any problem (format,
// signature, expiry, kind, locale), so callers answer one indistinct 404; signatures compare in constant time
import { LOCALES } from '../../shared/types/enums.ts'
import type { Locale } from '../../shared/types/enums.ts'
import { logger } from './logger.ts'

export const PREVIEW_MAX_HOURS = 24
export const PREVIEW_KINDS = ['article'] as const
export type PreviewKind = (typeof PREVIEW_KINDS)[number]

export interface PreviewClaims {
  kind: PreviewKind
  id: string
  locale: Locale
  /** Unix seconds */
  expiresAt: number
}

const MIN_SECRET_LENGTH = 32
const MAX_TOKEN_LENGTH = 512
const encoder = new TextEncoder()

let ephemeralSecret: string | undefined

// Workers' constant-time comparison (not in the DOM typing of SubtleCrypto); it requires equal lengths
const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual: (a: ArrayBufferView, b: ArrayBufferView) => boolean }

/** PREVIEW_TOKEN_SECRET is required outside local (fail closed); local dev and tests get a random per-isolate one */
export function resolvePreviewSecret(env: { PREVIEW_TOKEN_SECRET?: string | undefined, ENVIRONMENT?: string | undefined }): string {
  if (env.PREVIEW_TOKEN_SECRET) {
    if (env.PREVIEW_TOKEN_SECRET.length < MIN_SECRET_LENGTH) {
      throw new Error(`PREVIEW_TOKEN_SECRET must have at least ${MIN_SECRET_LENGTH} characters`)
    }
    return env.PREVIEW_TOKEN_SECRET
  }
  if (env.ENVIRONMENT !== 'local') {
    throw new Error('PREVIEW_TOKEN_SECRET is not set')
  }
  if (!ephemeralSecret) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    ephemeralSecret = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
    logger.warn('preview.ephemeral_secret', { reason: 'PREVIEW_TOKEN_SECRET not set; preview links end when the isolate restarts' })
  }
  return ephemeralSecret
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[\w-]+$/.test(text)) {
    return null
  }
  try {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
    return Uint8Array.from(binary, char => char.charCodeAt(0))
  }
  catch {
    return null
  }
}

async function sign(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))
}

/** A token for `hours` (1–24) from `now` */
export async function createPreviewToken(secret: string, claims: Omit<PreviewClaims, 'expiresAt'>, hours: number, now = Date.now()): Promise<{ token: string, expiresAt: number }> {
  if (!Number.isInteger(hours) || hours < 1 || hours > PREVIEW_MAX_HOURS) {
    throw new RangeError(`hours must be an integer from 1 to ${PREVIEW_MAX_HOURS}`)
  }
  const expiresAt = Math.floor(now / 1000) + hours * 3600
  // Fixed key order: the signature covers these exact bytes
  const payload = toBase64Url(encoder.encode(JSON.stringify({ t: claims.kind, id: claims.id, l: claims.locale, exp: expiresAt })))
  return { token: `${payload}.${toBase64Url(await sign(secret, payload))}`, expiresAt }
}

/** The claims of a valid, unexpired token, or null */
export async function verifyPreviewToken(secret: string, token: string, now = Date.now()): Promise<PreviewClaims | null> {
  if (token.length > MAX_TOKEN_LENGTH) {
    return null
  }
  const [payload, signature, ...rest] = token.split('.')
  if (!payload || !signature || rest.length > 0) {
    return null
  }
  const given = fromBase64Url(signature)
  const expected = await sign(secret, payload)
  if (!given || given.byteLength !== expected.byteLength || !subtle.timingSafeEqual(given, expected)) {
    return null
  }
  const bytes = fromBase64Url(payload)
  let claims: unknown
  try {
    claims = bytes ? JSON.parse(new TextDecoder().decode(bytes)) : null
  }
  catch {
    return null
  }
  const { t, id, l, exp } = (claims ?? {}) as Record<string, unknown>
  const nowSeconds = Math.floor(now / 1000)
  const valid = (PREVIEW_KINDS as readonly unknown[]).includes(t)
    && typeof id === 'string' && /^[\w-]{1,64}$/.test(id)
    && (LOCALES as readonly unknown[]).includes(l)
    && typeof exp === 'number' && Number.isInteger(exp)
    && exp > nowSeconds && exp <= nowSeconds + PREVIEW_MAX_HOURS * 3600
  return valid ? { kind: t as PreviewKind, id: id as string, locale: l as Locale, expiresAt: exp as number } : null
}
