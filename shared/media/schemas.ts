// Media upload manifest (ADR-0007 §3–§4): what the admin declares before sending any byte. The server derives
// every upload name and R2 key from it (shared/media/keys.ts), so nothing the user types becomes a path
import { z } from 'zod'
import { LOCALES, MEDIA_TRACK_KINDS } from '../types/enums.ts'

export const IMAGE_WIDTHS = [320, 640, 960, 1280, 1920, 2560] as const
export const IMAGE_FORMATS = ['avif', 'webp', 'jpeg'] as const
export type ImageFormat = (typeof IMAGE_FORMATS)[number]

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const
export const TRACK_MIME_TYPE = 'text/vtt'
export type MediaMimeType = (typeof IMAGE_MIME_TYPES)[number] | (typeof VIDEO_MIME_TYPES)[number] | typeof TRACK_MIME_TYPE

export const FORMAT_MIME_TYPES: Record<ImageFormat, MediaMimeType> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
}

export const MIME_EXTENSIONS: Record<MediaMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'text/vtt': 'vtt',
}

/** Bytes (1 MB = 1,000,000) */
export const MEDIA_LIMITS = {
  variantBytes: 10_000_000,
  originalBytes: 25_000_000,
  videoBytes: 95_000_000,
  trackBytes: 1_000_000,
  maxDimension: 16_384,
  maxDurationMs: 4 * 60 * 60 * 1000,
  placeholderChars: 4096,
  maxTracks: 10,
} as const

/** Largest body any upload may carry; the origin middleware refuses bigger ones before they reach a handler */
export const MAX_UPLOAD_BYTES = Math.max(MEDIA_LIMITS.variantBytes, MEDIA_LIMITS.originalBytes, MEDIA_LIMITS.videoBytes, MEDIA_LIMITS.trackBytes)

const dimension = z.number().int().min(1).max(MEDIA_LIMITS.maxDimension)
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'Lowercase hex SHA-256')
// Shown in the admin only; never part of a key. No path separators or control characters
// eslint-disable-next-line no-control-regex
const filename = z.string().min(1).max(255).regex(/^[^/\\\u0000-\u001F\u007F]+$/, 'Plain file name')

const imageVariant = z.object({
  format: z.enum(IMAGE_FORMATS),
  width: dimension,
  height: dimension,
  size: z.number().int().min(1).max(MEDIA_LIMITS.variantBytes),
}).strict()

export const imageManifestSchema = z.object({
  kind: z.literal('image'),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  originalFilename: filename,
  size: z.number().int().min(1).max(MEDIA_LIMITS.originalBytes),
  width: dimension,
  height: dimension,
  sha256,
  placeholderDataUrl: z.string().max(MEDIA_LIMITS.placeholderChars).regex(/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/),
  dominantColor: z.string().regex(/^#[0-9a-f]{6}$/),
  variants: z.array(imageVariant).min(1).max(IMAGE_WIDTHS.length * IMAGE_FORMATS.length),
}).strict().superRefine((manifest, context) => {
  for (const issue of imageVariantIssues(manifest)) {
    context.addIssue({ code: 'custom', path: ['variants'], message: issue })
  }
})

const track = z.object({
  locale: z.enum(LOCALES),
  kind: z.enum(MEDIA_TRACK_KINDS),
  label: z.string().trim().min(1).max(64),
  size: z.number().int().min(1).max(MEDIA_LIMITS.trackBytes),
}).strict()

export const videoManifestSchema = z.object({
  kind: z.literal('video'),
  mimeType: z.enum(VIDEO_MIME_TYPES),
  originalFilename: filename,
  size: z.number().int().min(1).max(MEDIA_LIMITS.videoBytes),
  width: dimension,
  height: dimension,
  durationMs: z.number().int().min(1).max(MEDIA_LIMITS.maxDurationMs),
  sha256,
  posterMediaId: z.string().min(1).max(64),
  tracks: z.array(track).max(MEDIA_LIMITS.maxTracks).default([]),
}).strict().superRefine((manifest, context) => {
  const seen = new Set(manifest.tracks.map(item => `${item.kind}-${item.locale}`))
  if (seen.size !== manifest.tracks.length) {
    context.addIssue({ code: 'custom', path: ['tracks'], message: 'One track per kind and locale' })
  }
})

export const mediaManifestSchema = z.discriminatedUnion('kind', [imageManifestSchema, videoManifestSchema])
export type ImageManifest = z.output<typeof imageManifestSchema>
export type VideoManifest = z.output<typeof videoManifestSchema>
export type MediaManifest = z.output<typeof mediaManifestSchema>

type ImageVariantInput = Pick<ImageManifest, 'width' | 'height'> & { variants: Pick<ImageManifest['variants'][number], 'format' | 'width' | 'height'>[] }

/**
 * Widths come from IMAGE_WIDTHS (or the original's own width, for images narrower than a step) and never exceed the
 * original; heights keep its aspect ratio within rounding; every width ships in all three formats, once
 */
export function imageVariantIssues(manifest: ImageVariantInput): string[] {
  const issues: string[] = []
  const names = new Set<string>()
  for (const variant of manifest.variants) {
    const name = `${variant.format}-${variant.width}`
    if (names.has(name)) {
      issues.push(`Duplicate variant ${name}`)
    }
    names.add(name)
    if (variant.width > manifest.width || !(IMAGE_WIDTHS as readonly number[]).concat(manifest.width).includes(variant.width)) {
      issues.push(`Width ${variant.width} is not allowed for a ${manifest.width} px original`)
    }
    if (Math.abs(variant.height - Math.round(variant.width * manifest.height / manifest.width)) > 1) {
      issues.push(`Variant ${name} does not keep the original aspect ratio`)
    }
  }
  for (const width of new Set(manifest.variants.map(variant => variant.width))) {
    for (const format of IMAGE_FORMATS) {
      if (!names.has(`${format}-${width}`)) {
        issues.push(`Missing ${format} at ${width} px`)
      }
    }
  }
  return issues
}
