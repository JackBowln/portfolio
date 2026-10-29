// F04-T1: the manifest limits what an upload may contain, and every key comes from the record (ADR-0007 §1, §3)
import { describe, expect, it } from 'vitest'
import { expectedUploads } from '../../shared/media/keys'
import { imageVariantIssues, MAX_UPLOAD_BYTES, mediaManifestSchema } from '../../shared/media/schemas'

const SHA = 'ab'.repeat(32)

function image(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'image',
    mimeType: 'image/jpeg',
    originalFilename: 'foto.jpg',
    size: 2_000_000,
    width: 1000,
    height: 750,
    sha256: SHA,
    placeholderDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    dominantColor: '#1a2b3c',
    variants: ['avif', 'webp', 'jpeg'].flatMap(format => [320, 640].map(width => ({ format, width, height: width * 0.75, size: 10_000 }))),
    ...overrides,
  }
}

describe('media manifest', () => {
  it('accepts a complete image manifest and a video one', () => {
    expect(mediaManifestSchema.safeParse(image()).success).toBe(true)
    expect(mediaManifestSchema.safeParse({
      kind: 'video', mimeType: 'video/mp4', originalFilename: 'demo.mp4', size: 50_000_000, width: 1920, height: 1080,
      durationMs: 30_000, sha256: SHA, posterMediaId: 'x', tracks: [{ locale: 'de', kind: 'captions', label: 'Deutsch', size: 2000 }],
    }).success).toBe(true)
  })

  it('refuses unknown keys, SVG, path-like names and sizes over the limits', () => {
    for (const [label, overrides] of Object.entries({
      extraKey: { key: 'media/../x' },
      svg: { mimeType: 'image/svg+xml' },
      slash: { originalFilename: '../../etc/passwd' },
      control: { originalFilename: 'a\u0000.jpg' },
      original: { size: 25_000_001 },
      variant: { variants: [{ format: 'avif', width: 320, height: 240, size: 10_000_001 }] },
      sha: { sha256: 'AB'.repeat(32) },
      placeholder: { placeholderDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' },
    })) {
      expect(mediaManifestSchema.safeParse(image(overrides)).success, label).toBe(false)
    }
    expect(MAX_UPLOAD_BYTES).toBe(95_000_000)
  })

  it('checks widths, aspect ratio and that each width comes in every format', () => {
    expect(imageVariantIssues({ width: 1000, height: 750, variants: [{ format: 'avif', width: 1280, height: 960 }] }))
      .toContain('Width 1280 is not allowed for a 1000 px original')
    expect(imageVariantIssues({ width: 1000, height: 750, variants: [{ format: 'avif', width: 500, height: 375 }] }))
      .toContain('Width 500 is not allowed for a 1000 px original')
    expect(imageVariantIssues({ width: 1000, height: 750, variants: [{ format: 'avif', width: 320, height: 300 }] }))
      .toContain('Variant avif-320 does not keep the original aspect ratio')
    expect(imageVariantIssues({ width: 1000, height: 750, variants: [{ format: 'avif', width: 320, height: 240 }] }))
      .toEqual(['Missing webp at 320 px', 'Missing jpeg at 320 px'])
    // An original narrower than the first step ships at its own width
    expect(imageVariantIssues({ width: 300, height: 200, variants: ['avif', 'webp', 'jpeg'].map(format => ({ format: format as 'avif', width: 300, height: 200 })) }))
      .toEqual([])
  })
})

describe('expectedUploads', () => {
  it('derives every key from the hash: variants are public, the image original is not', () => {
    const uploads = expectedUploads({ kind: 'image', sha256: SHA, mimeType: 'image/png', sizeBytes: 9, variants: [{ format: 'jpeg', width: 320, size: 5 }], tracks: [] })
    expect(uploads).toEqual([
      { name: 'original', contentType: 'image/png', size: 9, key: `originals/${SHA}.png` },
      { name: 'jpeg-320', contentType: 'image/jpeg', size: 5, key: `media/ab/${SHA}/jpeg-320.jpg` },
    ])
  })

  it('puts a video and its tracks under the same prefix', () => {
    const uploads = expectedUploads({ kind: 'video', sha256: SHA, mimeType: 'video/webm', sizeBytes: 9, variants: [], tracks: [{ locale: 'fr', kind: 'subtitles', size: 3 }] })
    expect(uploads.map(upload => [upload.name, upload.contentType, upload.key])).toEqual([
      ['original', 'video/webm', `media/ab/${SHA}/video.webm`],
      ['subtitles-fr', 'text/vtt', `media/ab/${SHA}/subtitles-fr.vtt`],
    ])
  })
})
