// UUIDv7 (RFC 9562 §5.7): 48-bit Unix ms timestamp, version 7, 12-bit counter (rand_a), variant 10, 62 random bits.
// The counter keeps IDs strictly increasing when several are created in the same millisecond.

let lastMs = -1
let counter = 0

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

export function uuidv7(now: number = Date.now()): string {
  let ms = now
  if (ms > lastMs) {
    lastMs = ms
    counter = crypto.getRandomValues(new Uint16Array(1))[0]! & 0x7FF // leave headroom before overflow
  }
  else {
    ms = lastMs
    counter++
    if (counter > 0xFFF) {
      lastMs++
      ms = lastMs
      counter = 0
    }
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xFF
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xFF
  bytes[2] = (ms >>> 24) & 0xFF
  bytes[3] = (ms >>> 16) & 0xFF
  bytes[4] = (ms >>> 8) & 0xFF
  bytes[5] = ms & 0xFF
  bytes[6] = 0x70 | (counter >>> 8)
  bytes[7] = counter & 0xFF
  bytes[8] = 0x80 | (bytes[8]! & 0x3F)

  const value = hex(bytes)
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

const UUIDV7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isUuidv7(value: string): boolean {
  return UUIDV7_PATTERN.test(value)
}
