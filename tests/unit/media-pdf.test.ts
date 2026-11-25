// F13-T5 (ADR-0017): a CV is one PDF. Its manifest is strict and at most 5 MB, its key is fixed under the media prefix,
// the public key pattern delivers exactly that key, and the bytes must start with the PDF header
import { describe, expect, it } from 'vitest'
import { expectedUploads } from '../../shared/media/keys'
import { MEDIA_LIMITS, mediaManifestSchema } from '../../shared/media/schemas'
import { isPublicMediaKey } from '../../shared/media/public'
import { deliveryDispositionHeaders } from '../../server/utils/media-delivery'
import { sniffMediaType } from '../../server/utils/magic-bytes'

const sha = 'ab'.repeat(32)
const file = { kind: 'file', mimeType: 'application/pdf', originalFilename: 'cv.pdf', size: 120_000, sha256: sha }

describe('PDF media', () => {
  it('accepts a PDF manifest and refuses one over the limit or with another type', () => {
    expect(mediaManifestSchema.safeParse(file).success).toBe(true)
    expect(mediaManifestSchema.safeParse({ ...file, size: MEDIA_LIMITS.fileBytes + 1 }).success).toBe(false)
    expect(mediaManifestSchema.safeParse({ ...file, mimeType: 'image/jpeg' }).success).toBe(false)
    expect(mediaManifestSchema.safeParse({ ...file, width: 10 }).success).toBe(false)
  })

  it('stores the PDF under the media prefix with a fixed name, and that key is public', () => {
    const [upload] = expectedUploads({ kind: 'file', sha256: sha, mimeType: 'application/pdf', sizeBytes: 120_000, variants: [], tracks: [] })
    expect(upload).toEqual({ name: 'original', contentType: 'application/pdf', size: 120_000, key: `media/ab/${sha}/file.pdf` })
    expect(isPublicMediaKey(upload!.key)).toBe(true)
  })

  it('keeps image originals private', () => {
    expect(isPublicMediaKey(`originals/${sha}.jpg`)).toBe(false)
  })

  it('sniffs a PDF by its header only', () => {
    expect(sniffMediaType(new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n1 0 obj'))).toBe('application/pdf')
    expect(sniffMediaType(new TextEncoder().encode('%PDX-1.7'))).toBeNull()
  })

  it('delivers a PDF as a download under a sandbox policy, and an image inline', () => {
    expect(deliveryDispositionHeaders('application/pdf')).toEqual({ 'content-disposition': 'attachment; filename="cv.pdf"', 'content-security-policy': 'default-src \'none\'; sandbox' })
    expect(deliveryDispositionHeaders('image/jpeg')).toEqual({ 'content-disposition': 'inline' })
  })
})
