// Client IPs (ADR-0012 §10): read only from Cloudflare's own header and stored only as an HMAC with IP_HASH_SALT.
// Takes plain Headers, so Better Auth hooks and h3 handlers share it
const IP_HEADER = 'cf-connecting-ip'

/** The visitor's IP as Cloudflare saw it; X-Forwarded-For is client-controlled and ignored */
export function clientIp(headers: Headers | undefined | null): string | null {
  const ip = headers?.get(IP_HEADER)?.trim()
  return ip ? ip : null
}

/** HMAC-SHA256 in hex; without a salt (or an IP) there is nothing to store, never an unsalted hash */
export async function hashIp(ip: string | null | undefined, salt: string | undefined): Promise<string | null> {
  if (!ip || !salt) {
    return null
  }
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(ip)))
  return [...signature].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
