// F04-T2: the pure parts of the admin image pipeline (ADR-0007 §2): widths, the manifest the API accepts and the
// lossless removal of EXIF/GPS, XMP, IPTC and comments from originals
import { describe, expect, it } from 'vitest'
import { buildImageManifest, exifOrientation, rgbToHex, stripImageMetadata, targetWidths, UnsupportedImageError, variantHeight } from '../../shared/media/pipeline'
import { IMAGE_FORMATS, mediaManifestSchema } from '../../shared/media/schemas'
import { exifApp1, hasLocationMetadata, SIGNATURES } from '../support/media'

const SOI = Buffer.from([0xFF, 0xD8])
const segment = (marker: number, payload: Buffer) => {
  const header = Buffer.from([0xFF, marker, 0, 0])
  header.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([header, payload])
}
const JFIF = segment(0xE0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'))
const ICC = segment(0xE2, Buffer.from('ICC_PROFILE\0\x01\x01profile-bytes', 'latin1'))
const SCAN = Buffer.from([0xFF, 0xDA, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0x12, 0x34, 0xFF, 0xD9])

function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)])
}

function webpChunk(fourcc: string, data: Buffer) {
  const size = Buffer.alloc(4)
  size.writeUInt32LE(data.length)
  return Buffer.concat([Buffer.from(fourcc, 'latin1'), size, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)])
}

describe('targetWidths and variantHeight', () => {
  it('uses every step up to the original, or the original width alone below the first step', () => {
    expect(targetWidths(4000)).toEqual([320, 640, 960, 1280, 1920, 2560])
    expect(targetWidths(1280)).toEqual([320, 640, 960, 1280])
    expect(targetWidths(1000)).toEqual([320, 640, 960])
    expect(targetWidths(200)).toEqual([200])
  })

  it('keeps the aspect ratio with the rounding the API checks', () => {
    expect(variantHeight(320, 4000, 3000)).toBe(240)
    expect(variantHeight(320, 1000, 333)).toBe(107)
    expect(variantHeight(320, 10_000, 1)).toBe(1)
  })
})

describe('buildImageManifest', () => {
  it('produces a manifest the upload API accepts', () => {
    const variants = targetWidths(1000).flatMap(width => IMAGE_FORMATS.map(format => ({ format, width, height: variantHeight(width, 1000, 750), size: 1234 })))
    const manifest = buildImageManifest({
      mimeType: 'image/jpeg',
      originalFilename: 'foto.jpg',
      size: 5000,
      width: 1000,
      height: 750,
      sha256: 'ab'.repeat(32),
      placeholderDataUrl: 'data:image/webp;base64,UklGRg==',
      dominantColor: rgbToHex({ r: 0.1, g: 0.5, b: 1 }),
      variants,
    })
    expect(mediaManifestSchema.safeParse(manifest).success).toBe(true)
    expect(manifest.dominantColor).toBe('#1a80ff')
  })
})

describe('stripImageMetadata', () => {
  it('removes EXIF/GPS, XMP, IPTC and comments from a JPEG and keeps JFIF, ICC and the image data', () => {
    const xmp = segment(0xE1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>', 'latin1'))
    const iptc = segment(0xED, Buffer.from('Photoshop 3.0\0', 'latin1'))
    const comment = segment(0xFE, Buffer.from('shot at home', 'latin1'))
    const jpeg = Buffer.concat([SOI, JFIF, exifApp1(), xmp, ICC, iptc, comment, SCAN])

    const stripped = Buffer.from(stripImageMetadata(jpeg, 'image/jpeg'))
    expect(hasLocationMetadata(stripped)).toBe(false)
    expect(stripped.includes(Buffer.from('xmpmeta'))).toBe(false)
    expect(stripped.includes(Buffer.from('Photoshop'))).toBe(false)
    expect(stripped.includes(Buffer.from('shot at home'))).toBe(false)
    expect(stripped).toEqual(Buffer.concat([SOI, JFIF, ICC, SCAN]))
  })

  it('keeps only the orientation of a rotated JPEG, after APP0', () => {
    const jpeg = Buffer.concat([SOI, JFIF, exifApp1({ orientation: 6 }), SCAN])
    const stripped = Buffer.from(stripImageMetadata(jpeg, 'image/jpeg'))

    expect(stripped.includes(Buffer.from('TestCam'))).toBe(false)
    expect(stripped.subarray(0, 2 + JFIF.length)).toEqual(Buffer.concat([SOI, JFIF]))
    const app1 = stripped.subarray(2 + JFIF.length)
    expect([app1[0], app1[1]]).toEqual([0xFF, 0xE1])
    expect(exifOrientation(app1.subarray(4, 4 + app1.readUInt16BE(2) - 2))).toBe(6)
    expect(stripped.subarray(-SCAN.length)).toEqual(SCAN)
  })

  it('drops eXIf and text chunks from a PNG', () => {
    const png = Buffer.concat([
      Buffer.from(SIGNATURES['image/png'].slice(0, 8)),
      pngChunk('IHDR', Buffer.alloc(13)),
      pngChunk('eXIf', exifApp1().subarray(10)),
      pngChunk('tEXt', Buffer.from('GPS\0-23.5', 'latin1')),
      pngChunk('iCCP', Buffer.from('icc', 'latin1')),
      pngChunk('IDAT', Buffer.from([1, 2, 3])),
      pngChunk('IEND', Buffer.alloc(0)),
    ])
    const stripped = Buffer.from(stripImageMetadata(png, 'image/png'))
    const types = [...stripped.toString('latin1').matchAll(/(IHDR|eXIf|tEXt|iCCP|IDAT|IEND)/g)].map(match => match[1])
    expect(types).toEqual(['IHDR', 'iCCP', 'IDAT', 'IEND'])
  })

  it('drops EXIF and XMP chunks from a WebP, clears their VP8X flags and fixes the RIFF size', () => {
    const vp8x = Buffer.from([0x08 | 0x04 | 0x20, 0, 0, 0, 9, 0, 0, 9, 0, 0])
    const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), webpChunk('VP8X', vp8x), webpChunk('ICCP', Buffer.from('icc')), webpChunk('VP8 ', Buffer.from([1, 2, 3, 4])), webpChunk('EXIF', exifApp1().subarray(10)), webpChunk('XMP ', Buffer.from('<x:xmpmeta/>'))])
    const riff = Buffer.alloc(8)
    riff.write('RIFF', 0, 'latin1')
    riff.writeUInt32LE(body.length, 4)

    const stripped = Buffer.from(stripImageMetadata(Buffer.concat([riff, body]), 'image/webp'))
    expect(stripped.readUInt32LE(4)).toBe(stripped.length - 8)
    expect(stripped.includes(Buffer.from('EXIF'))).toBe(false)
    expect(stripped.includes(Buffer.from('xmpmeta'))).toBe(false)
    // VP8X flags: ICC (0x20) stays, EXIF (0x08) and XMP (0x04) go
    expect(stripped[20]).toBe(0x20)
    expect(stripped.includes(Buffer.from('ICCP'))).toBe(true)
  })

  it('refuses AVIF (re-encoded instead), wrong signatures and truncated segments', () => {
    expect(() => stripImageMetadata(new Uint8Array(SIGNATURES['image/avif']), 'image/avif')).toThrow(UnsupportedImageError)
    expect(() => stripImageMetadata(new Uint8Array(SIGNATURES['image/png']), 'image/jpeg')).toThrow(UnsupportedImageError)
    expect(() => stripImageMetadata(Buffer.concat([SOI, Buffer.from([0xFF, 0xE1, 0x7F, 0xFF, 0])]), 'image/jpeg')).toThrow(UnsupportedImageError)
  })
})
