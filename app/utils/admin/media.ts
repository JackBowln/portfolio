// Admin-only. Shapes of the media API (server/api/admin/media/**) as the library screens use them
import { toPublicImage } from '#shared/media/public'
import type { PublicImage } from '#shared/media/public'
import type { ImageFormat } from '#shared/media/schemas'
import type { Locale, MediaTrackKind, MediaUsageContext, TranslationState } from '#shared/types/enums'

export interface MediaListItem {
  id: string
  kind: 'image' | 'video' | 'file'
  status: 'pending' | 'ready'
  mimeType: string
  originalFilename: string
  width: number | null
  height: number | null
  placeholderDataUrl: string | null
  dominantColor: string | null
  decorative: boolean
  thumbnailKey: string | null
  missingAlt: boolean
  createdAt: string
}

export interface MediaLocalization {
  locale: Locale
  alt: string
  caption: string | null
  credit: string | null
  translationState: TranslationState
}

export interface MediaUsage {
  entityType: string
  entityId: string
  locale: Locale | null
  context: MediaUsageContext
}

export interface MediaDetail {
  id: string
  kind: 'image' | 'video' | 'file'
  status: 'pending' | 'ready'
  mimeType: string
  originalFilename: string
  sizeBytes: number
  width: number | null
  height: number | null
  durationMs: number | null
  variants: { name: string, format: ImageFormat, width: number, height: number, key: string, size: number }[]
  placeholderDataUrl: string | null
  dominantColor: string | null
  focalX: number
  focalY: number
  decorative: boolean
  posterMediaId: string | null
  /** The delivered video file; null for images */
  fileKey: string | null
  createdBy: string | null
  createdAt: string
  localizations: MediaLocalization[]
  tracks: { locale: Locale, kind: MediaTrackKind, label: string, key: string }[]
  usages: MediaUsage[]
}

/** An image item as public pages would see it in pt-BR, for previews in the admin */
export function previewImage(item: Pick<MediaDetail, 'width' | 'height' | 'variants' | 'placeholderDataUrl' | 'dominantColor' | 'focalX' | 'focalY' | 'decorative'> & { localizations?: MediaLocalization[] }): PublicImage {
  return toPublicImage(item, item.localizations ?? [], 'pt-BR')
}

/** A grid thumbnail: only the smallest WebP is known in the list, which is all a card needs */
export function thumbnailImage(item: MediaListItem): PublicImage | null {
  if (!item.thumbnailKey || !item.width || !item.height) {
    return null
  }
  const width = Number(/-(\d+)\.webp$/.exec(item.thumbnailKey)?.[1] ?? item.width)
  return previewImage({
    width: item.width,
    height: item.height,
    variants: [{ name: `webp-${width}`, format: 'webp', width, height: Math.round(width * item.height / item.width), key: item.thumbnailKey, size: 0 }],
    placeholderDataUrl: item.placeholderDataUrl,
    dominantColor: item.dominantColor,
    focalX: 0.5,
    focalY: 0.5,
    decorative: true,
  })
}
