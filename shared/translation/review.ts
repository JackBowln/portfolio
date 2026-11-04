// The review routes' parameters (F09-T4): a translatable type, an id, a target locale (never pt-BR)
import { z } from 'zod'
import { TARGET_LOCALES } from './glossary.ts'

export const TRANSLATABLE_TYPES = ['article', 'project', 'page'] as const

export const reviewParamsSchema = z.object({
  type: z.enum(TRANSLATABLE_TYPES),
  id: z.string().min(1).max(64),
  locale: z.enum(TARGET_LOCALES),
})
