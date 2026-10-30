// What the admin sends for projects (F07-T1, data-model §4.5), shared by the forms and the API so both apply the same
// limits. Strict at every level: an unknown field is an error. Versions, restores and publishing take the same
// bodies as articles (article-input.ts)
import { z } from 'zod'
import { isUuidv7 } from '../utils/id.ts'
import { ARTICLE_LIMITS, slugField } from './article-input.ts'
import type { DocumentJson } from './document-schema.ts'
import { CURRENT_SCHEMA_VERSION, documentSchema } from './document-schema.ts'

export const PROJECT_LIMITS = {
  title: ARTICLE_LIMITS.title,
  summary: 300,
  role: 120,
  url: 500,
  technologies: 20,
  gallery: 24,
  highlights: 6,
  highlightLabel: 60,
  highlightValue: 40,
  highlightNote: 200,
  seoTitle: ARTICLE_LIMITS.seoTitle,
  seoDescription: ARTICLE_LIMITS.seoDescription,
} as const

/** The order of the admin list goes up to this many projects in one request */
export const PROJECT_ORDER_MAX = 200

const mediaId = z.string().refine(isUuidv7, 'must be a media id')
const entityId = z.string().refine(isUuidv7, 'must be an id')
const title = z.string().trim().min(1, 'required').max(PROJECT_LIMITS.title)
const optionalText = (max: number) => z.string().trim().max(max).transform(value => (value === '' ? null : value)).nullable()
const uniqueIds = (schema: z.ZodType<string>, max: number, message: string) => z.array(schema).max(max).refine(ids => new Set(ids).size === ids.length, message)

/** An https: link, or null to clear it (an empty field clears it too) */
const httpsUrl = z.string().trim().max(PROJECT_LIMITS.url)
  .transform(value => (value === '' ? null : value))
  .pipe(z.url({ protocol: /^https$/, hostname: z.regexes.domain, error: 'must be an https: link' }).nullable())
  .nullable()

/** YYYY-MM */
export const YEAR_MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/
const yearMonth = z.string().regex(YEAR_MONTH, 'must be YYYY-MM').nullable()

/** A verifiable result: what was measured and the value; never an invented metric (data-model §4.5) */
export const highlightSchema = z.strictObject({
  label: z.string().trim().min(1, 'required').max(PROJECT_LIMITS.highlightLabel),
  value: z.string().trim().min(1, 'required').max(PROJECT_LIMITS.highlightValue),
  note: z.string().trim().max(PROJECT_LIMITS.highlightNote).optional().transform(value => (value ? value : undefined)),
})

export type ProjectHighlight = z.output<typeof highlightSchema>
/** As a form holds it, before the note is trimmed away */
export type ProjectHighlightInput = z.input<typeof highlightSchema>

export const projectCreateSchema = z.strictObject({ title })

export const projectUpdateSchema = z.strictObject({
  /** The version the editor read; a mismatch means someone saved in between */
  version: z.int().min(1),
  title: title.optional(),
  slug: slugField.optional(),
  summary: z.string().trim().max(PROJECT_LIMITS.summary).optional(),
  role: z.string().trim().max(PROJECT_LIMITS.role).optional(),
  body: documentSchema.optional(),
  highlights: z.array(highlightSchema).max(PROJECT_LIMITS.highlights).optional(),
  seoTitle: optionalText(PROJECT_LIMITS.seoTitle).optional(),
  seoDescription: optionalText(PROJECT_LIMITS.seoDescription).optional(),
  ogImageMediaId: mediaId.nullable().optional(),
  noindex: z.boolean().optional(),
  coverMediaId: mediaId.nullable().optional(),
  galleryMediaIds: uniqueIds(mediaId, PROJECT_LIMITS.gallery, 'an image appears twice').optional(),
  technologyIds: uniqueIds(entityId, PROJECT_LIMITS.technologies, 'a technology appears twice').optional(),
  periodStart: yearMonth.optional(),
  periodEnd: yearMonth.optional(),
  repoUrl: httpsUrl.optional(),
  demoUrl: httpsUrl.optional(),
  featured: z.boolean().optional(),
}).refine(input => Object.keys(input).length > 1, 'nothing to update')

export type ProjectUpdate = z.output<typeof projectUpdateSchema>

/** The manual order of the list: every project id, first to last */
export const projectOrderSchema = z.strictObject({
  ids: uniqueIds(entityId, PROJECT_ORDER_MAX, 'a project appears twice').min(1),
})

/** The case study sections a new project starts with (RF-09.1); the text is pt-BR, the source language */
export const PROJECT_SECTIONS = ['Contexto', 'Desafio', 'Solução', 'Resultados'] as const

export function projectTemplate(): DocumentJson {
  return {
    type: 'doc',
    attrs: { schemaVersion: CURRENT_SCHEMA_VERSION },
    content: PROJECT_SECTIONS.flatMap((section, index) => [
      { type: 'heading' as const, attrs: { id: `section-${index + 1}`, level: 2 as const }, content: [{ type: 'text' as const, text: section }] },
      { type: 'paragraph' as const, attrs: { id: `section-${index + 1}-text` } },
    ]),
  }
}
