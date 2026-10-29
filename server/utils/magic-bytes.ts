// Content checks on the first bytes of an upload (ADR-0007 §3): the type comes from the bytes, never from the
// name or the declared MIME, and markup in the head of a binary file marks a polyglot. Only the head is read:
// scanning whole files would not fit the CPU budget, so nosniff and the stored Content-Type stay the outer layer
import type { MediaMimeType } from '#shared/media/schemas'

/** How much of an upload is inspected */
export const SNIFF_BYTES = 64 * 1024

const ascii = (text: string) => [...text].map(char => char.charCodeAt(0))

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte)
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

const AVIF_BRANDS = new Set(['avif', 'avis'])
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ', 'mmp4'])

/** ISO BMFF (`ftyp` box): AVIF when its major or a compatible brand is avif/avis, MP4 for the usual video brands */
function sniffIsoBmff(bytes: Uint8Array): MediaMimeType | null {
  if (bytes.length < 16 || readAscii(bytes, 4, 4) !== 'ftyp') {
    return null
  }
  const boxSize = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0
  const end = Math.min(boxSize, bytes.length)
  const brands = [readAscii(bytes, 8, 4)]
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    brands.push(readAscii(bytes, offset, 4))
  }
  if (brands.some(brand => AVIF_BRANDS.has(brand))) {
    return 'image/avif'
  }
  return MP4_BRANDS.has(brands[0]!) ? 'video/mp4' : null
}

/** EBML header with the `webm` DocType (plain Matroska is not accepted) */
function isWebm(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, [0x1A, 0x45, 0xDF, 0xA3])) {
    return false
  }
  const header = bytes.subarray(0, 64)
  const docType = ascii('webm')
  return header.some((_, index) => startsWith(header, docType, index))
}

/** WebVTT: optional UTF-8 BOM, then "WEBVTT" followed by a space, tab, line break or the end of the file */
function isWebVtt(bytes: Uint8Array): boolean {
  const offset = startsWith(bytes, [0xEF, 0xBB, 0xBF]) ? 3 : 0
  if (!startsWith(bytes, ascii('WEBVTT'), offset)) {
    return false
  }
  const next = bytes[offset + 6]
  return next === undefined || [0x20, 0x09, 0x0A, 0x0D].includes(next)
}

/** The type the bytes actually are, among the accepted ones; null for anything else (SVG and HTML included) */
export function sniffMediaType(bytes: Uint8Array): MediaMimeType | null {
  if (startsWith(bytes, [0xFF, 0xD8, 0xFF])) {
    return 'image/jpeg'
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
    return 'image/png'
  }
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) {
    return 'image/webp'
  }
  if (isWebm(bytes)) {
    return 'video/webm'
  }
  if (isWebVtt(bytes)) {
    return 'text/vtt'
  }
  return sniffIsoBmff(bytes)
}

// Markup a browser or an interpreter would act on; matched case-insensitively
const MARKUP = ['<script', '<html', '<svg', '<?xml', '<!doctype', '<iframe', '<object', '<embed', '<?php'].map(ascii)

/** True when the bytes carry HTML, SVG, XML or PHP markup (a polyglot) */
export function containsMarkup(bytes: Uint8Array): boolean {
  for (let index = bytes.indexOf(0x3C); index !== -1; index = bytes.indexOf(0x3C, index + 1)) {
    for (const pattern of MARKUP) {
      // Letters are compared lowercased (ASCII | 0x20); the other pattern bytes must match exactly
      if (pattern.every((byte, offset) => {
        const value = bytes[index + offset]
        return value !== undefined && (byte >= 0x61 && byte <= 0x7A ? (value | 0x20) === byte : value === byte)
      })) {
        return true
      }
    }
  }
  return false
}
