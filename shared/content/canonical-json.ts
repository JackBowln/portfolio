// Canonical JSON for content hashes (data-model §4.3): object keys sorted by code point, no whitespace, undefined
// object members left out. The same value always gives the same text, so the hash only changes with the content
import { toHex } from '../media/pipeline.ts'

export class NonCanonicalValueError extends Error {}

function write(value: unknown, path: string): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new NonCanonicalValueError(`${path}: ${value} has no JSON form`)
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => {
      if (item === undefined) {
        // JSON.stringify would turn it into null and the round trip would differ
        throw new NonCanonicalValueError(`${path}[${index}]: undefined in an array`)
      }
      return write(item, `${path}[${index}]`)
    }).join(',')}]`
  }
  if (typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      // Code point order, independent of locale
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${write(item, `${path}.${key}`)}`).join(',')}}`
  }
  throw new NonCanonicalValueError(`${path}: ${typeof value === 'object' ? (value as object).constructor?.name ?? 'object' : typeof value} is not plain JSON`)
}

export function canonicalJson(value: unknown): string {
  return write(value, '$')
}

/** SHA-256 hex of the canonical JSON */
export async function contentHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)))
  return toHex(new Uint8Array(digest))
}
