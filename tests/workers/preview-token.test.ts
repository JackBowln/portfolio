// F06-T3: preview tokens. Signed and verified with the same secret; expired, too far ahead, tampered (payload or
// signature), signed with another secret, of an unknown kind or locale, or malformed tokens all verify to null;
// the secret fails closed outside local
import { describe, expect, it } from 'vitest'
import { createPreviewToken, PREVIEW_MAX_HOURS, resolvePreviewSecret, verifyPreviewToken } from '../../server/utils/preview-token'

const SECRET = 'a'.repeat(32)
const OTHER = 'b'.repeat(32)
const claims = { kind: 'article' as const, id: '01a18000-0000-7000-8000-000000000001', locale: 'pt-BR' as const }
const now = Date.UTC(2026, 9, 30, 12)
const b64 = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

describe('preview tokens', () => {
  it('verify with the same secret until they expire', async () => {
    const { token, expiresAt } = await createPreviewToken(SECRET, claims, 8, now)
    expect(expiresAt).toBe(now / 1000 + 8 * 3600)
    expect(await verifyPreviewToken(SECRET, token, now)).toEqual({ ...claims, expiresAt })
    expect(await verifyPreviewToken(SECRET, token, (expiresAt - 1) * 1000)).not.toBeNull()
    expect(await verifyPreviewToken(SECRET, token, expiresAt * 1000)).toBeNull()
    expect(await verifyPreviewToken(OTHER, token, now)).toBeNull()
  })

  it('accept 1 to 24 whole hours only', async () => {
    for (const hours of [0, 25, 1.5, -1, Number.NaN]) {
      await expect(createPreviewToken(SECRET, claims, hours, now)).rejects.toThrow(RangeError)
    }
    expect((await createPreviewToken(SECRET, claims, PREVIEW_MAX_HOURS, now)).expiresAt).toBe(now / 1000 + 24 * 3600)
  })

  it('reject any change to the payload or the signature', async () => {
    const { token } = await createPreviewToken(SECRET, claims, 1, now)
    const [payload, signature] = token.split('.') as [string, string]
    const forged = b64({ t: 'article', id: '01a18000-0000-7000-8000-000000000002', l: 'pt-BR', exp: now / 1000 + 3600 })
    const flip = (text: string) => (text.at(-2) === 'A' ? `${text.slice(0, -2)}B${text.at(-1)}` : `${text.slice(0, -2)}A${text.at(-1)}`)
    for (const candidate of [
      `${forged}.${signature}`,
      `${payload}.${flip(signature)}`,
      `${flip(payload)}.${signature}`,
      `${payload}.${signature.slice(0, -4)}`,
      `${payload}.${signature}.extra`,
      `${payload}.`,
      `.${signature}`,
      payload,
      '',
      `${payload}.${signature}`.repeat(10),
      `${payload}.${signature}=`,
      `${payload}.${signature.replace(/./, '+')}`,
    ]) {
      expect(await verifyPreviewToken(SECRET, candidate, now), candidate.slice(0, 40)).toBeNull()
    }
  })

  it('reject well-signed payloads with unknown kinds, locales, ids or lifetimes', async () => {
    const signed = async (value: unknown) => {
      const payload = b64(value)
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
      return `${payload}.${btoa(String.fromCharCode(...signature)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`
    }
    const exp = now / 1000 + 3600
    expect(await verifyPreviewToken(SECRET, await signed({ t: 'article', id: claims.id, l: 'pt-BR', exp }), now)).not.toBeNull()
    for (const value of [
      { t: 'page', id: claims.id, l: 'pt-BR', exp },
      { t: 'article', id: claims.id, l: 'it', exp },
      { t: 'article', id: '../x', l: 'pt-BR', exp },
      { t: 'article', id: claims.id, l: 'pt-BR', exp: String(exp) },
      { t: 'article', id: claims.id, l: 'pt-BR', exp: now / 1000 + 25 * 3600 },
      { t: 'article', id: claims.id, l: 'pt-BR' },
      ['article'],
      null,
    ]) {
      expect(await verifyPreviewToken(SECRET, await signed(value), now), JSON.stringify(value)).toBeNull()
    }
  })

  it('needs a long secret outside local, and makes one up locally', () => {
    expect(resolvePreviewSecret({ PREVIEW_TOKEN_SECRET: SECRET, ENVIRONMENT: 'production' })).toBe(SECRET)
    expect(() => resolvePreviewSecret({ ENVIRONMENT: 'production' })).toThrow('not set')
    expect(() => resolvePreviewSecret({ ENVIRONMENT: 'preview' })).toThrow('not set')
    expect(() => resolvePreviewSecret({ PREVIEW_TOKEN_SECRET: 'short', ENVIRONMENT: 'local' })).toThrow('at least 32')
    const local = resolvePreviewSecret({ ENVIRONMENT: 'local' })
    expect(local).toHaveLength(64)
    expect(resolvePreviewSecret({ ENVIRONMENT: 'local' })).toBe(local)
  })
})
