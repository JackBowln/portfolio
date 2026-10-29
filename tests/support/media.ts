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

/**
 * A JPEG APP1 "Exif" segment, big endian: IFD0 with Make, an optional Orientation and a GPS IFD with
 * latitude 23°33′S (what a phone writes), so tests can prove all of it leaves the original
 */
export function exifApp1({ make = 'TestCam', orientation }: { make?: string, orientation?: number } = {}): Buffer {
  const makeBytes = Buffer.from(`${make}\0`, 'latin1')
  const entries = orientation ? 3 : 2
  const ifd0Size = 2 + entries * 12 + 4
  const makeOffset = 8 + ifd0Size
  const gpsOffset = makeOffset + makeBytes.length
  const gpsEntries = 2
  const latitudeOffset = gpsOffset + 2 + gpsEntries * 12 + 4
  const tiff = Buffer.alloc(latitudeOffset + 24)
  tiff.write('MM', 0, 'latin1')
  tiff.writeUInt16BE(42, 2)
  tiff.writeUInt32BE(8, 4)
  let offset = 8
  tiff.writeUInt16BE(entries, offset)
  offset += 2
  const entry = (tag: number, type: number, count: number, value: number, short = false) => {
    tiff.writeUInt16BE(tag, offset)
    tiff.writeUInt16BE(type, offset + 2)
    tiff.writeUInt32BE(count, offset + 4)
    if (short) {
      tiff.writeUInt16BE(value, offset + 8)
    }
    else {
      tiff.writeUInt32BE(value, offset + 8)
    }
    offset += 12
  }
  entry(0x010F, 2, makeBytes.length, makeOffset)
  if (orientation) {
    entry(0x0112, 3, 1, orientation, true)
  }
  entry(0x8825, 4, 1, gpsOffset)
  tiff.writeUInt32BE(0, offset)
  makeBytes.copy(tiff, makeOffset)
  offset = gpsOffset
  tiff.writeUInt16BE(gpsEntries, offset)
  offset += 2
  entry(0x0001, 2, 2, 0x53000000) // GPSLatitudeRef "S"
  entry(0x0002, 5, 3, latitudeOffset) // GPSLatitude, three rationals
  tiff.writeUInt32BE(0, offset)
  for (const [index, [numerator, denominator]] of [[23, 1], [33, 1], [0, 1]].entries()) {
    tiff.writeUInt32BE(numerator!, latitudeOffset + index * 8)
    tiff.writeUInt32BE(denominator!, latitudeOffset + index * 8 + 4)
  }
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const header = Buffer.from([0xFF, 0xE1, 0, 0])
  header.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([header, payload])
}

/** The JPEG with an EXIF/GPS block inserted right after SOI */
export function withExif(jpeg: Buffer, app1: Buffer = exifApp1()): Buffer {
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)])
}

/** True when the bytes still carry EXIF, the GPS latitude or the camera name */
export function hasLocationMetadata(bytes: Uint8Array, make = 'TestCam'): boolean {
  const buffer = Buffer.from(bytes)
  return buffer.includes(Buffer.from('Exif\0\0', 'latin1')) || buffer.includes(Buffer.from(make, 'latin1'))
}
