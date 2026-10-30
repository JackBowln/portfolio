// Admin-only. Articles and topics as the admin API returns them (F06-T1), and how to read its errors: a 409 or 400
// names the field in `data.issues[].path`, so a form can point at it
import type { DocumentJson } from '#shared/content/document-schema'
import type { Locale, PublicationStatus, TranslationState } from '#shared/types/enums'

export interface ArticleLocalization {
  id: string
  locale: Locale
  title: string
  slug: string
  excerpt: string
  body: DocumentJson
  seoTitle: string | null
  seoDescription: string | null
  ogImageMediaId: string | null
  noindex: boolean
  status: PublicationStatus
  translationState: TranslationState
  wordCount: number
  readingTimeMin: number
  version: number
  updatedAt: string
  publishedAt: string | null
}

export interface ArticleDetail {
  id: string
  authorId: string
  authorName: string | null
  featured: boolean
  coverMediaId: string | null
  tagIds: string[]
  createdAt: string
  updatedAt: string
  localizations: ArticleLocalization[]
}

export interface ArticleListItem {
  id: string
  authorName: string | null
  featured: boolean
  updatedAt: string
  localizations: { locale: Locale, title: string, slug: string, status: PublicationStatus, translationState: TranslationState, updatedAt: string }[]
}

export interface TopicItem {
  id: string
  name: string
  slug: string
  uses: number
}

export interface ApiIssue {
  path: string
  message: string
}

/** Status and issues of a failed admin request; status 0 when it never reached the server */
export function apiError(error: unknown): { status: number, issues: ApiIssue[] } {
  const response = (error as { response?: { status: number, _data?: { data?: { issues?: ApiIssue[] } } } }).response
  return { status: response?.status ?? 0, issues: response?._data?.data?.issues ?? [] }
}

export const hasIssue = (issues: ApiIssue[], path: string) => issues.some(issue => issue.path === path || issue.path.startsWith(`${path}.`))
