// Glossary entries (F09-T2, data-model §7): shared by the admin form and the server, which decides. A term is either
// kept as it is in every translation (doNotTranslate) or translated as given, for one locale or for all of them
import { z } from 'zod'
import { LOCALES, SOURCE_LOCALE } from '../types/enums.ts'

export const TARGET_LOCALES = LOCALES.filter(locale => locale !== SOURCE_LOCALE) as ['en', 'es', 'de', 'fr']
export const GLOSSARY_LIMITS = { term: 100, translation: 200, note: 300 } as const

const optional = (max: number) => z.string().trim().max(max, 'too_long').transform(value => value || null).nullable().default(null)

export const glossaryTermSchema = z.strictObject({
  term: z.string().trim().min(1, 'required').max(GLOSSARY_LIMITS.term, 'too_long'),
  /** null: every target locale */
  locale: z.enum(TARGET_LOCALES).nullable().default(null),
  translation: optional(GLOSSARY_LIMITS.translation),
  doNotTranslate: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  note: optional(GLOSSARY_LIMITS.note),
}).superRefine((entry, context) => {
  if (entry.doNotTranslate && entry.translation !== null) {
    context.addIssue({ code: 'custom', path: ['translation'], message: 'not_with_do_not_translate' })
  }
  if (!entry.doNotTranslate && entry.translation === null) {
    context.addIssue({ code: 'custom', path: ['translation'], message: 'required' })
  }
})

export type GlossaryTermInput = z.output<typeof glossaryTermSchema>

export interface GlossaryTerm extends GlossaryTermInput {
  id: string
  updatedAt: string
}
