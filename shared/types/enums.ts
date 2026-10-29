// Shared enums from docs/architecture/data-model.md §2: single source for the DB schema, zod and the UI

export const LOCALES = ['pt-BR', 'en', 'es', 'de', 'fr'] as const
export type Locale = (typeof LOCALES)[number]
export const SOURCE_LOCALE: Locale = 'pt-BR'

export const PUBLICATION_STATUSES = ['draft', 'scheduled', 'published', 'unpublished'] as const
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number]

export const TRANSLATION_STATES = ['source', 'missing', 'machine', 'in_review', 'approved', 'outdated'] as const
export type TranslationState = (typeof TRANSLATION_STATES)[number]

export const REVISION_KINDS = ['autosave', 'manual', 'publish', 'restore', 'ai'] as const
export type RevisionKind = (typeof REVISION_KINDS)[number]

export const ROLES = ['owner', 'admin', 'editor', 'author', 'translator', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const MEDIA_KINDS = ['image', 'video', 'file'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export const MEDIA_STATUSES = ['pending', 'ready', 'deleted'] as const
export type MediaStatus = (typeof MEDIA_STATUSES)[number]

export const TAG_KINDS = ['topic', 'technology'] as const
export type TagKind = (typeof TAG_KINDS)[number]

export const PAGE_KEYS = ['home', 'about', 'contact', 'privacy', 'blog', 'projects'] as const
export type PageKey = (typeof PAGE_KEYS)[number]

export const SITE_SETTING_KEYS = ['identity', 'social', 'contact', 'seo_defaults', 'navigation', 'footer', 'ai_translation', 'features'] as const
export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number]

export const REDIRECT_STATUS_CODES = [301, 302, 308] as const
export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number]

export const MEDIA_TRACK_KINDS = ['captions', 'subtitles'] as const
export type MediaTrackKind = (typeof MEDIA_TRACK_KINDS)[number]

export const MEDIA_USAGE_CONTEXTS = ['body', 'cover', 'og', 'gallery', 'poster', 'settings'] as const
export type MediaUsageContext = (typeof MEDIA_USAGE_CONTEXTS)[number]
