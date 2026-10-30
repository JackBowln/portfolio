// What a preview link returns (F06-T3): one localization's working copy with its media in the public shape
import type { PublicImage, PublicMediaMap } from '../media/public.ts'
import type { Locale } from '../types/enums.ts'
import type { DocumentJson } from './document-schema.ts'

export interface ArticlePreview {
  locale: Locale
  title: string
  excerpt: string
  body: DocumentJson
  readingTimeMin: number
  cover: PublicImage | null
  media: PublicMediaMap
  /** Unix seconds; the page says until when the link works */
  expiresAt: number
}
