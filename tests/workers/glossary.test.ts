// F09-T2: the glossary on a real D1. One entry per term and locale whatever the case ("every locale" counts as one);
// a term is kept or translated, never both (schema and table); a locale's own entry wins over the one for all
// locales; what the translation flow reads protects the kept terms and lists the translations
import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { glossaryTerms, users } from '../../server/db/schema'
import { createGlossaryTerm, deleteGlossaryTerm, glossaryFor, listGlossary, updateGlossaryTerm } from '../../server/services/translation/glossary.service'
import { glossaryTermSchema } from '../../shared/translation/glossary'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Glossário', email: `glossary-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const unique = () => uuidv7().slice(-6)
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))
const entry = (input: Record<string, unknown>) => glossaryTermSchema.parse(input)

describe('glossary', () => {
  it('validates the kind of entry, even after strict()', () => {
    for (const schema of [glossaryTermSchema, glossaryTermSchema.strict()]) {
      expect(schema.safeParse({ term: 'Nuxt', doNotTranslate: true }).success).toBe(true)
      expect(schema.safeParse({ term: 'Nuxt', doNotTranslate: true, translation: 'x' }).error?.issues[0]).toMatchObject({ path: ['translation'], message: 'not_with_do_not_translate' })
      expect(schema.safeParse({ term: 'servidor' }).error?.issues[0]).toMatchObject({ path: ['translation'], message: 'required' })
      expect(schema.safeParse({ term: 'servidor', translation: 'server', locale: 'pt-BR' }).success).toBe(false)
      expect(schema.safeParse({ term: 'x', translation: 'y', extra: 1 }).success).toBe(false)
    }
  })

  it('keeps one entry per term and locale, whatever the case, and refuses a kept term with a translation', async () => {
    const term = `Edge ${unique()}`
    const first = await createGlossaryTerm(db, userId, entry({ term, translation: 'Edge', locale: 'de' }))
    expect(await errorOf(createGlossaryTerm(db, userId, entry({ term: term.toUpperCase(), translation: 'Rand', locale: 'de' })))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'term', message: 'taken' }] } })
    // Another locale, and "every locale", are other entries
    await createGlossaryTerm(db, userId, entry({ term, translation: 'Edge', locale: 'fr' }))
    await createGlossaryTerm(db, userId, entry({ term, doNotTranslate: true }))
    expect(await errorOf(createGlossaryTerm(db, userId, entry({ term, doNotTranslate: true })))).toMatchObject({ statusCode: 409 })
    await expect(db.insert(glossaryTerms).values({ term: `x${unique()}`, doNotTranslate: true, translation: 'y' })).rejects.toThrow()

    const updated = await updateGlossaryTerm(db, userId, first.id, entry({ term, translation: 'Kante', locale: 'de', note: 'Nur hier' }))
    expect(updated).toMatchObject({ translation: 'Kante', note: 'Nur hier' })
    expect((await listGlossary(db)).filter(item => item.term.toLowerCase() === term.toLowerCase())).toHaveLength(3)
    await deleteGlossaryTerm(db, first.id)
    expect(await errorOf(deleteGlossaryTerm(db, first.id))).toMatchObject({ statusCode: 404 })
    expect(await errorOf(updateGlossaryTerm(db, userId, first.id, entry({ term, translation: 'x' })))).toMatchObject({ statusCode: 404 })
  })

  it('gives the translation flow the protected terms and the translations of a locale, the locale entry first', async () => {
    const kept = `Workers${unique()}`
    const shared = `servidor${unique()}`
    await createGlossaryTerm(db, userId, entry({ term: kept, doNotTranslate: true, caseSensitive: true }))
    await createGlossaryTerm(db, userId, entry({ term: shared, translation: 'server' }))
    await createGlossaryTerm(db, userId, entry({ term: shared, translation: 'Server', locale: 'de' }))
    const german = await glossaryFor(db, 'de')
    expect(german.protected).toContainEqual({ term: kept, caseSensitive: true })
    expect(german.translations).toContainEqual({ term: shared, translation: 'Server' })
    expect(german.translations).not.toContainEqual({ term: shared, translation: 'server' })
    expect((await glossaryFor(db, 'en')).translations).toContainEqual({ term: shared, translation: 'server' })
  })
})
