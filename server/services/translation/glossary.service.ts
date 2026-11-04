// The glossary (F09-T2): listed and edited in the admin, audited; read by the translation flow (F09-T3) for the
// terms to protect (segmenter placeholders) and the translations to put in the prompt, per target locale
import { asc, eq, isNull, or } from 'drizzle-orm'
import type { ProtectedTerm } from '../../../shared/content/inline-tags.ts'
import type { GlossaryTerm, GlossaryTermInput } from '../../../shared/translation/glossary.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { glossaryTerms } from '../../db/schema/translation.ts'
import { createAppError, isUniqueViolation } from '../../utils/errors.ts'

type Row = typeof glossaryTerms.$inferSelect

const toItem = (row: Row): GlossaryTerm => ({
  id: row.id,
  term: row.term,
  locale: row.locale as GlossaryTerm['locale'],
  translation: row.translation,
  doNotTranslate: row.doNotTranslate,
  caseSensitive: row.caseSensitive,
  note: row.note,
  updatedAt: row.updatedAt.toISOString(),
})

const duplicate = () => createAppError('conflict', 'Term already in the glossary', [{ path: 'term', message: 'taken' }])

export async function listGlossary(db: Db): Promise<GlossaryTerm[]> {
  const rows = await db.select().from(glossaryTerms).orderBy(asc(glossaryTerms.term), asc(glossaryTerms.locale))
  return rows.map(toItem)
}

export async function createGlossaryTerm(db: Db, userId: string, input: GlossaryTermInput): Promise<GlossaryTerm> {
  try {
    const [row] = await db.insert(glossaryTerms).values({ ...input, createdBy: userId, updatedBy: userId }).returning()
    return toItem(row!)
  }
  catch (error) {
    throw isUniqueViolation(error) ? duplicate() : error
  }
}

export async function updateGlossaryTerm(db: Db, userId: string, id: string, input: GlossaryTermInput): Promise<GlossaryTerm> {
  let rows: Row[]
  try {
    rows = await db.update(glossaryTerms).set({ ...input, updatedBy: userId, updatedAt: new Date() }).where(eq(glossaryTerms.id, id)).returning()
  }
  catch (error) {
    throw isUniqueViolation(error) ? duplicate() : error
  }
  if (!rows[0]) {
    throw createAppError('not_found')
  }
  return toItem(rows[0])
}

export async function deleteGlossaryTerm(db: Db, id: string): Promise<void> {
  const rows = await db.delete(glossaryTerms).where(eq(glossaryTerms.id, id)).returning({ id: glossaryTerms.id })
  if (rows.length === 0) {
    throw createAppError('not_found')
  }
}

/** For one target locale: the terms to keep as they are, and the translations the prompt asks for */
export async function glossaryFor(db: Db, locale: Locale): Promise<{ protected: ProtectedTerm[], translations: { term: string, translation: string }[] }> {
  const rows = await db.select().from(glossaryTerms).where(or(isNull(glossaryTerms.locale), eq(glossaryTerms.locale, locale)))
  // A locale's own entry wins over the one for every locale
  const byTerm = new Map<string, Row>()
  for (const row of rows.sort((a, b) => Number(a.locale !== null) - Number(b.locale !== null))) {
    byTerm.set(row.term.toLowerCase(), row)
  }
  const entries = [...byTerm.values()]
  return {
    protected: entries.filter(row => row.doNotTranslate).map(row => ({ term: row.term, caseSensitive: row.caseSensitive })),
    translations: entries.filter(row => !row.doNotTranslate && row.translation).map(row => ({ term: row.term, translation: row.translation! })),
  }
}
