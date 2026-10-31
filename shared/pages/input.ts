// What the admin sends to save a page (F08-T2): the version it read, the page's blocks (its key's schema) and the SEO
// fields, as articles do. Strict: an unknown field is an error
import { z } from 'zod'
import { ARTICLE_LIMITS } from '../content/article-input.ts'
import type { PageKey } from '../types/enums.ts'
import { isUuidv7 } from '../utils/id.ts'
import { pageBlockSchemas } from './blocks.ts'

const optionalText = (max: number) => z.string().trim().max(max).transform(value => (value === '' ? null : value)).nullable()

export function pageUpdateSchema(key: PageKey) {
  return z.strictObject({
    version: z.int().min(1),
    blocks: pageBlockSchemas[key].optional(),
    seoTitle: optionalText(ARTICLE_LIMITS.seoTitle).optional(),
    seoDescription: optionalText(ARTICLE_LIMITS.seoDescription).optional(),
    ogImageMediaId: z.string().refine(isUuidv7, 'must be a media id').nullable().optional(),
    noindex: z.boolean().optional(),
  }).refine(input => Object.keys(input).length > 1, 'nothing to update')
}

/** A save once validated by its page's schema */
export interface PageUpdate {
  version: number
  blocks?: unknown
  seoTitle?: string | null | undefined
  seoDescription?: string | null | undefined
  ogImageMediaId?: string | null | undefined
  noindex?: boolean | undefined
}
