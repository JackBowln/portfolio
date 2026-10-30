// What the admin sends for articles and topics (F06-T1), shared by the forms and the API so both apply the same
// limits. Strict at every level: an unknown field is an error. The document body has its own schema
// (document-schema.ts); the search-result limits are guidance for the SERP preview, not validation
import { z } from 'zod'
import { LOCALES, PUBLICATION_STATUSES, TRANSLATION_STATES } from '../types/enums.ts'
import { isUuidv7 } from '../utils/id.ts'
import { MAX_SLUG_LENGTH, SLUG_PATTERN } from '../utils/slugify.ts'
import { documentSchema } from './document-schema.ts'

export const ARTICLE_LIMITS = {
  title: 200,
  excerpt: 300,
  seoTitle: 200,
  seoDescription: 500,
  tags: 12,
} as const

/** Recommended lengths of a search result (Google truncates around them) */
export const SERP_LIMITS = { title: 60, descriptionMin: 120, descriptionMax: 160 } as const

export const TAG_NAME_MAX = 60

const mediaId = z.string().refine(isUuidv7, 'must be a media id')
const entityId = z.string().refine(isUuidv7, 'must be an id')
export const slugField = z.string()
  .max(MAX_SLUG_LENGTH, `at most ${MAX_SLUG_LENGTH} characters`)
  .regex(SLUG_PATTERN, 'lowercase letters, digits and single hyphens only')
const title = z.string().trim().min(1, 'required').max(ARTICLE_LIMITS.title)
const optionalText = (max: number) => z.string().trim().max(max).transform(value => (value === '' ? null : value)).nullable()

export const articleCreateSchema = z.strictObject({ title })

export const articleUpdateSchema = z.strictObject({
  /** The version the editor read; a mismatch means someone saved in between */
  version: z.int().min(1),
  title: title.optional(),
  slug: slugField.optional(),
  excerpt: z.string().trim().max(ARTICLE_LIMITS.excerpt).optional(),
  body: documentSchema.optional(),
  seoTitle: optionalText(ARTICLE_LIMITS.seoTitle).optional(),
  seoDescription: optionalText(ARTICLE_LIMITS.seoDescription).optional(),
  ogImageMediaId: mediaId.nullable().optional(),
  noindex: z.boolean().optional(),
  coverMediaId: mediaId.nullable().optional(),
  tagIds: z.array(entityId).max(ARTICLE_LIMITS.tags)
    .refine(ids => new Set(ids).size === ids.length, 'a topic appears twice')
    .optional(),
  featured: z.boolean().optional(),
}).refine(input => Object.keys(input).length > 1, 'nothing to update')

export type ArticleUpdate = z.output<typeof articleUpdateSchema>

export const articleListQuerySchema = z.strictObject({
  status: z.enum(PUBLICATION_STATUSES).optional(),
  locale: z.enum(LOCALES).optional(),
  translationState: z.enum(TRANSLATION_STATES).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const tagCreateSchema = z.strictObject({
  name: z.string().trim().min(1, 'required').max(TAG_NAME_MAX),
  slug: slugField.optional(),
})

export const tagUpdateSchema = z.strictObject({
  name: z.string().trim().min(1, 'required').max(TAG_NAME_MAX).optional(),
  slug: slugField.optional(),
}).refine(input => Object.keys(input).length > 0, 'nothing to update')

export const VERSION_NOTE_MAX = 200

/** A named version of the working copy (F06-T2) */
export const articleVersionSchema = z.strictObject({
  version: z.int().min(1),
  note: optionalText(VERSION_NOTE_MAX).optional(),
})

/** Back to an older revision; the version is the one the editor read */
export const articleRestoreSchema = z.strictObject({
  version: z.int().min(1),
  revisionId: entityId,
})

/** Lifetimes the admin offers for a preview link (F06-T3); the server accepts any whole hour up to 24 */
export const PREVIEW_HOURS = [1, 8, 24] as const

export const previewLinkSchema = z.strictObject({
  hours: z.int().min(1).max(24),
})
