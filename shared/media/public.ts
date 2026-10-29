// What a public page receives about a media item (ADR-0007 §5–§6): only delivered keys, sizes and the text of one
// locale. Keys are checked again here before they become URLs, so nothing but a delivered object is ever linked
import { SOURCE_LOCALE } from '../types/enums.ts'
import type { Locale, MediaTrackKind } from '../types/enums.ts'
import type { ImageFormat } from './schemas.ts'

/** Delivered objects only: variants, the video file and its tracks. `originals/` never matches */
export const PUBLIC_MEDIA_KEY = /^media\/([0-9a-f]{2})\/\1[0-9a-f]{62}\/(?:(?:avif|webp|jpeg)-\d{1,5}\.(?:avif|webp|jpg)|video\.(?:mp4|webm)|(?:captions|subtitles)-[A-Za-z]{2}(?:-[A-Z]{2})?\.vtt)$/

export function isPublicMediaKey(key: string): boolean {
  return PUBLIC_MEDIA_KEY.test(key)
}

/** MEDIA_BASE_URL + "/" + key; undefined for anything that is not a delivered object */
export function mediaUrl(baseUrl: string, key: string): string | undefined {
  return isPublicMediaKey(key) ? `${baseUrl.replace(/\/+$/, '')}/${key}` : undefined
}

export interface PublicImage {
  width: number
  height: number
  variants: { format: ImageFormat, width: number, height: number, key: string }[]
  placeholderDataUrl: string | null
  dominantColor: string | null
  focalX: number
  focalY: number
  /** Empty only when decorative */
  alt: string
  decorative: boolean
  caption: string | null
  credit: string | null
}

export interface PublicVideo {
  width: number
  height: number
  key: string
  mimeType: string
  durationMs: number | null
  poster: PublicImage | null
  tracks: { locale: Locale, kind: MediaTrackKind, label: string, key: string }[]
}

export interface ImageRecord {
  width: number | null
  height: number | null
  variants: { format: ImageFormat, width: number, height: number, key: string }[]
  placeholderDataUrl: string | null
  dominantColor: string | null
  focalX: number
  focalY: number
  decorative: boolean
}

export interface LocalizationRecord {
  locale: Locale
  alt: string
  caption: string | null
  credit: string | null
}

/** The locale's text, or the source locale's when it has no translation yet */
export function toPublicImage(record: ImageRecord, localizations: LocalizationRecord[], locale: Locale): PublicImage {
  const text = localizations.find(item => item.locale === locale && item.alt) ?? localizations.find(item => item.locale === SOURCE_LOCALE)
  return {
    width: record.width ?? 0,
    height: record.height ?? 0,
    variants: record.variants.map(({ format, width, height, key }) => ({ format, width, height, key })),
    placeholderDataUrl: record.placeholderDataUrl,
    dominantColor: record.dominantColor,
    focalX: record.focalX,
    focalY: record.focalY,
    alt: record.decorative ? '' : text?.alt ?? '',
    decorative: record.decorative,
    caption: text?.caption ?? null,
    credit: text?.credit ?? null,
  }
}

/** One media item as a document renders it; a document carries a map of these by media id */
export type PublicMedia = { kind: 'image', image: PublicImage } | { kind: 'video', video: PublicVideo }
export type PublicMediaMap = Record<string, PublicMedia>
