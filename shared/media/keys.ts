// Every upload of a media item and its R2 key, derived only from the stored record (ADR-0007 §1): content
// addressed by the SHA-256, so delivered objects can be cached as immutable. Originals of images are never served
import type { MediaKind, MediaTrackKind, Locale } from '../types/enums.ts'
import { FORMAT_MIME_TYPES, MIME_EXTENSIONS, TRACK_MIME_TYPE } from './schemas.ts'
import type { ImageFormat, MediaMimeType } from './schemas.ts'

export interface ExpectedUpload {
  name: string
  contentType: MediaMimeType
  size: number
  key: string
}

export interface UploadPlanInput {
  kind: MediaKind
  sha256: string
  mimeType: MediaMimeType
  sizeBytes: number
  variants: { format: ImageFormat, width: number, size: number }[]
  tracks: { locale: Locale, kind: MediaTrackKind, size: number }[]
}

export function mediaPrefix(sha256: string): string {
  return `media/${sha256.slice(0, 2)}/${sha256}`
}

export function imageVariantName(format: ImageFormat, width: number): string {
  return `${format}-${width}`
}

export function trackName(kind: MediaTrackKind, locale: Locale): string {
  return `${kind}-${locale}`
}

/** The uploads that must all be present before finalize; names are what PUT …/variants/:name accepts */
export function expectedUploads(media: UploadPlanInput): ExpectedUpload[] {
  const prefix = mediaPrefix(media.sha256)
  if (media.kind === 'video') {
    return [
      { name: 'original', contentType: media.mimeType, size: media.sizeBytes, key: `${prefix}/video.${MIME_EXTENSIONS[media.mimeType]}` },
      ...media.tracks.map(track => ({
        name: trackName(track.kind, track.locale),
        contentType: TRACK_MIME_TYPE,
        size: track.size,
        key: `${prefix}/${trackName(track.kind, track.locale)}.vtt`,
      } satisfies ExpectedUpload)),
    ]
  }
  return [
    { name: 'original', contentType: media.mimeType, size: media.sizeBytes, key: `originals/${media.sha256}.${MIME_EXTENSIONS[media.mimeType]}` },
    ...media.variants.map(variant => ({
      name: imageVariantName(variant.format, variant.width),
      contentType: FORMAT_MIME_TYPES[variant.format],
      size: variant.size,
      key: `${prefix}/${imageVariantName(variant.format, variant.width)}.${MIME_EXTENSIONS[FORMAT_MIME_TYPES[variant.format]]}`,
    } satisfies ExpectedUpload)),
  ]
}
