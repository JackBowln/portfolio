// Admin-only. Projects as the admin API returns them (F07-T1); errors read like articles' (utils/admin/articles.ts)
import type { DocumentJson } from '#shared/content/document-schema'
import type { ProjectHighlightInput } from '#shared/content/project-input'
import type { Locale, PublicationStatus, TranslationState } from '#shared/types/enums'
import type { ArticleLocalization } from './articles'

export interface ProjectEntityFields {
  coverMediaId: string | null
  galleryMediaIds: string[]
  technologyIds: string[]
  periodStart: string | null
  periodEnd: string | null
  repoUrl: string | null
  demoUrl: string | null
}

export interface ProjectLocalization extends Omit<ArticleLocalization, 'excerpt' | 'publishedSnapshot'> {
  summary: string
  role: string
  highlights: ProjectHighlightInput[]
  publishedSnapshot: {
    entity: ProjectEntityFields
    localization: { title: string, slug: string, summary: string, role: string, body: DocumentJson, highlights: ProjectHighlightInput[], seoTitle: string | null, seoDescription: string | null, ogImageMediaId: string | null, noindex: boolean }
  } | null
}

export interface ProjectDetail extends ProjectEntityFields {
  id: string
  authorId: string | null
  authorName: string | null
  featured: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  localizations: ProjectLocalization[]
}

export interface ProjectListItem {
  id: string
  authorName: string | null
  featured: boolean
  sortOrder: number
  updatedAt: string
  localizations: { locale: Locale, title: string, slug: string, status: PublicationStatus, translationState: TranslationState, updatedAt: string }[]
}
