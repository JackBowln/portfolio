// Byte fixtures for media uploads: the server checks magic bytes and markup only, so a file is its signature
// padded to the declared size. Shared by the unit tests (magic bytes) and the API tests (upload flow)
import { randomBytes } from 'node:crypto'

const text = (value: string) => [...Buffer.from(value, 'latin1')]

export const SIGNATURES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, ...text('JFIF'), 0x00],
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, ...text('IHDR')],
  'image/webp': [...text('RIFF'), 0x24, 0x00, 0x00, 0x00, ...text('WEBPVP8 ')],
  'image/avif': [0x00, 0x00, 0x00, 0x1C, ...text('ftypavif'), 0x00, 0x00, 0x00, 0x00, ...text('avifmif1miaf')],
  'video/mp4': [0x00, 0x00, 0x00, 0x18, ...text('ftypisom'), 0x00, 0x00, 0x02, 0x00, ...text('isommp41')],
  'video/webm': [0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84, ...text('webm')],
  'text/vtt': text('WEBVTT\n\n00:00.000 --> 00:01.000\nOlá\n'),
} as const

export type FixtureType = keyof typeof SIGNATURES

/** `size` bytes that start with the type's signature; the rest is zeros, so it holds no markup */
export function fileOf(type: FixtureType, size: number, extra: number[] = []): Buffer {
  const bytes = Buffer.alloc(size)
  Buffer.from([...SIGNATURES[type], ...extra]).copy(bytes)
  return bytes
}

export function randomSha256(): string {
  return randomBytes(32).toString('hex')
}

export const SVG = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
/** A JPEG whose head also carries HTML (a JPEG/HTML polyglot) */
export const POLYGLOT_JPEG = Buffer.concat([Buffer.from(SIGNATURES['image/jpeg']), Buffer.from('<html><script>alert(document.domain)</script></html>')])
