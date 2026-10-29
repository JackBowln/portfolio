// Pure parts of the admin image pipeline (ADR-0007 §2): target widths, the manifest for the upload API and lossless
// removal of metadata (EXIF/GPS, XMP, IPTC, comments) from the original. The Web Worker does the pixel work
import { IMAGE_WIDTHS } from './schemas.ts'
import type { ImageFormat, ImageManifest } from './schemas.ts'

/** IMAGE_WIDTHS up to the original's width; an original narrower than the first step ships at its own width */
export function targetWidths(originalWidth: number): number[] {
  const widths = IMAGE_WIDTHS.filter(width => width <= originalWidth)
  return widths.length > 0 ? widths : [originalWidth]
}

/** Same rounding the API checks (imageVariantIssues), never below 1 px */
export function variantHeight(width: number, originalWidth: number, originalHeight: number): number {
  return Math.max(1, Math.round(width * originalHeight / originalWidth))
}

export interface PipelineVariant {
  format: ImageFormat
  width: number
  height: number
  size: number
}

export interface PipelineResultMeta {
  mimeType: ImageManifest['mimeType']
  originalFilename: string
  size: number
  width: number
  height: number
  sha256: string
  placeholderDataUrl: string
  dominantColor: string
  variants: PipelineVariant[]
}

export function buildImageManifest(result: PipelineResultMeta): ImageManifest {
  return { kind: 'image', ...result, variants: result.variants.map(({ format, width, height, size }) => ({ format, width, height, size })) }
}

/** Lowercase hex, as the API expects for SHA-256 and as CSS takes for colors */
export function toHex(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** `#rrggbb` from channels in 0–1 */
export function rgbToHex({ r, g, b }: { r: number, g: number, b: number }): string {
  return `#${toHex(new Uint8Array([r, g, b].map(channel => Math.round(Math.min(1, Math.max(0, channel)) * 255))))}`
}

export class UnsupportedImageError extends Error {}

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length))

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.byteLength
  }
  return out
}

/** EXIF Orientation (tag 0x0112) from a JPEG APP1 "Exif" payload; 1 when absent or unreadable */
export function exifOrientation(payload: Uint8Array): number {
  if (ascii(payload, 0, 6) !== 'Exif\0\0') {
    return 1
  }
  const tiff = payload.subarray(6)
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  if (tiff.byteLength < 8) {
    return 1
  }
  const little = ascii(tiff, 0, 2) === 'II'
  const ifd = view.getUint32(4, little)
  if (ifd + 2 > tiff.byteLength) {
    return 1
  }
  const count = view.getUint16(ifd, little)
  for (let entry = 0; entry < count; entry++) {
    const offset = ifd + 2 + entry * 12
    if (offset + 12 > tiff.byteLength) {
      return 1
    }
    if (view.getUint16(offset, little) === 0x0112) {
      const value = view.getUint16(offset + 8, little)
      return value >= 1 && value <= 8 ? value : 1
    }
  }
  return 1
}

/** APP1 with an EXIF block that holds only the Orientation tag, so a later reprocess still turns the image right */
function orientationOnlyApp1(orientation: number): Uint8Array {
  const tiff = [
    0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, // big endian, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation, SHORT, 1
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]
  const payload = [...'Exif\0\0'].map(char => char.charCodeAt(0)).concat(tiff)
  const length = payload.length + 2
  return new Uint8Array([0xFF, 0xE1, length >> 8, length & 0xFF, ...payload])
}

// APP0 (JFIF), APP2 only for the ICC profile, APP14 (Adobe color transform) and every non-APP marker stay
function keepJpegSegment(marker: number, payload: Uint8Array): boolean {
  if (marker === 0xFE) {
    return false
  }
  if (marker < 0xE0 || marker > 0xEF) {
    return true
  }
  return marker === 0xE0 || marker === 0xEE || (marker === 0xE2 && ascii(payload, 0, 12) === 'ICC_PROFILE\0')
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    throw new UnsupportedImageError('Not a JPEG')
  }
  const parts: Uint8Array[] = [bytes.subarray(0, 2)]
  let orientation = 1
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xFF) {
      throw new UnsupportedImageError('Malformed JPEG segment')
    }
    const marker = bytes[offset + 1]!
    // Start of scan: the entropy-coded data and everything after it are kept as they are
    if (marker === 0xDA) {
      parts.push(bytes.subarray(offset))
      break
    }
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!
    const end = offset + 2 + length
    if (length < 2 || end > bytes.length) {
      throw new UnsupportedImageError('Malformed JPEG segment')
    }
    const payload = bytes.subarray(offset + 4, end)
    if (marker === 0xE1) {
      orientation = Math.max(orientation, exifOrientation(payload))
    }
    if (keepJpegSegment(marker, payload)) {
      parts.push(bytes.subarray(offset, end))
    }
    offset = end
  }
  if (orientation !== 1) {
    // Right after SOI, or after APP0 when there is one (JFIF wants APP0 first)
    const afterApp0 = parts[1]?.[0] === 0xFF && parts[1][1] === 0xE0 ? 2 : 1
    parts.splice(afterApp0, 0, orientationOnlyApp1(orientation))
  }
  return concat(parts)
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
const PNG_DROPPED = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])

function stripPng(bytes: Uint8Array): Uint8Array {
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new UnsupportedImageError('Not a PNG')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts: Uint8Array[] = [bytes.subarray(0, 8)]
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const end = offset + 12 + length
    if (end > bytes.length) {
      throw new UnsupportedImageError('Malformed PNG chunk')
    }
    const type = ascii(bytes, offset + 4, 4)
    if (!PNG_DROPPED.has(type)) {
      parts.push(bytes.subarray(offset, end))
    }
    offset = end
    if (type === 'IEND') {
      break
    }
  }
  return concat(parts)
}

const VP8X_XMP = 0x04
const VP8X_EXIF = 0x08

function stripWebp(bytes: Uint8Array): Uint8Array {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    throw new UnsupportedImageError('Not a WebP')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: Uint8Array[] = []
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset + 4, true)
    const end = offset + 8 + size + (size % 2)
    if (offset + 8 + size > bytes.length) {
      throw new UnsupportedImageError('Malformed WebP chunk')
    }
    const fourcc = ascii(bytes, offset, 4)
    if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      const chunk = bytes.slice(offset, Math.min(end, bytes.length))
      if (fourcc === 'VP8X') {
        chunk[8] = chunk[8]! & ~(VP8X_EXIF | VP8X_XMP)
      }
      chunks.push(chunk)
    }
    offset = end
  }
  const body = concat(chunks)
  const header = new Uint8Array(12)
  header.set(bytes.subarray(0, 12))
  new DataView(header.buffer).setUint32(4, body.byteLength + 4, true)
  return concat([header, body])
}

/**
 * The original without EXIF/GPS, XMP, IPTC or comments, losslessly. JPEG keeps only the orientation; the ICC
 * profile stays everywhere. AVIF has no lossless path here (its metadata sits in meta/iloc boxes): the pipeline
 * re-encodes those originals instead
 */
export function stripImageMetadata(bytes: Uint8Array, mimeType: string): Uint8Array {
  switch (mimeType) {
    case 'image/jpeg':
      return stripJpeg(bytes)
    case 'image/png':
      return stripPng(bytes)
    case 'image/webp':
      return stripWebp(bytes)
    default:
      throw new UnsupportedImageError(`No lossless metadata removal for ${mimeType}`)
  }
}
