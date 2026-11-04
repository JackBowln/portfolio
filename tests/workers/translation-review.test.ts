// F09-T4: the translation review on a real D1, with the fake provider. Translate → review side by side → save (to
// review) → approve → publish; tags checked per segment; the slug unique per locale and transliterated; the
// translation rebuilt on the current source (a new block comes in `missing` and blocks the approval); J-06: editing
// the source outdates only that block, and retranslating it calls the provider for that segment alone
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { siteSettings, users } from '../../server/db/schema'
import { createArticle, getArticle, updateArticle } from '../../server/services/content/articles.service'
import { publishArticle } from '../../server/services/content/publishing.service'
import { createFakeProvider } from '../../server/services/translation/providers/fake'
import type { FakeOptions } from '../../server/services/translation/providers/fake'
import { approveTranslation, getReview, saveReview } from '../../server/services/translation/review.service'
import { estimateTranslation, runTranslation } from '../../server/services/translation/run.service'
import type { DocumentJson } from '../../shared/content/document-schema'
import { settingSchemas } from '../../shared/settings/schemas'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Revisão', email: `review-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const actor = { userId, ip: null, ipHashSalt: undefined }
const unique = () => uuidv7().slice(-8)
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))

const doc = (...blocks: [string, string][]): DocumentJson => ({
  type: 'doc',
  attrs: { schemaVersion: 1 },
  content: blocks.map(([id, text]) => ({ type: 'paragraph' as const, attrs: { id }, content: [{ type: 'text' as const, text }, { type: 'text' as const, text: ' forte', marks: [{ type: 'bold' as const }] }] })),
})

beforeEach(async () => {
  const value = { ...settingSchemas.ai_translation.defaults.global, enabled: true, model: '@cf/qwen/qwen3-30b-a3b-fp8', dailyNeuronCap: 10_000, perJobNeuronCap: 10_000 }
  await db.insert(siteSettings).values({ key: 'ai_translation', value }).onConflictDoUpdate({ target: siteSettings.key, set: { value } })
})

async function published(body = doc(['a', 'Primeiro'], ['b', 'Segundo'])) {
  const draft = await createArticle(db, userId, `Revisão ${unique()}`)
  const saved = await updateArticle(db, userId, draft, { version: 1, excerpt: 'Resumo', body })
  return (await publishArticle(db, actor, saved, 'pt-BR', 2)).article
}

async function translate(id: string, locale: 'en' | 'de' | 'fr' | 'es', options: FakeOptions = {}, segmentIds?: string[]) {
  const provider = createFakeProvider(options)
  const deps = { provider: () => provider }
  const job = await estimateTranslation(db, deps, userId, { entityType: 'article', entityId: id, locale, segmentIds })
  await runTranslation(db, deps, job.id)
  return provider
}

const sourceOf = async (id: string) => (await getArticle(db, id)).localizations.find(copy => copy.locale === 'pt-BR')!

describe('J-05: translate, review, approve, publish', () => {
  it('shows the segments side by side, saves to review, approves and publishes the locale', async () => {
    const item = await published()
    await translate(item.id, 'en')
    const review = await getReview(db, 'article', item.id, 'en')
    expect(review.target).toMatchObject({ state: 'machine', status: 'draft' })
    expect(review.segments.map(segment => [segment.id, segment.status])).toEqual([['title', 'ok'], ['excerpt', 'ok'], ['block:a', 'ok'], ['block:b', 'ok']])
    expect(review.segments[2]).toMatchObject({ source: 'Primeiro<b> forte</b>', translation: '[en] Primeiro<b>[en]  forte</b>' })

    const saved = await saveReview(db, userId, 'article', item.id, 'en', { version: review.target!.version, segments: { 'block:a': 'First<b> strong</b>' }, slug: 'Café Ação' })
    expect(saved.target).toMatchObject({ state: 'in_review', slug: 'cafe-acao' })
    expect(saved.segments[2]).toMatchObject({ translation: 'First<b> strong</b>', previous: '[en] Primeiro<b>[en]  forte</b>' })

    const approved = await approveTranslation(db, userId, 'article', item.id, 'en', saved.target!.version)
    expect(approved.target?.state).toBe('approved')
    const english = (await getArticle(db, item.id)).localizations.find(copy => copy.locale === 'en')!
    expect(english.reviewedBy).toBe(userId)
    expect(english.segmentsMeta['block:a']).toMatchObject({ state: 'approved' })
    const { article } = await publishArticle(db, actor, await getArticle(db, item.id), 'en', english.version)
    expect(article.localizations.find(copy => copy.locale === 'en')).toMatchObject({ status: 'published', publishedSlug: 'cafe-acao' })
  })

  it('refuses a segment whose tags differ, a stale version, and a slug taken in the locale', async () => {
    const item = await published()
    await translate(item.id, 'de')
    const review = await getReview(db, 'article', item.id, 'de')
    const version = review.target!.version
    expect(await errorOf(saveReview(db, userId, 'article', item.id, 'de', { version, segments: { 'block:a': 'Erste stark' } }))).toMatchObject({ statusCode: 400, data: { issues: [{ path: 'segments.block:a', message: 'tags' }] } })
    expect(await errorOf(saveReview(db, userId, 'article', item.id, 'de', { version, segments: { 'block:zz': 'x' } }))).toMatchObject({ statusCode: 400, data: { issues: [{ message: 'unknown_segment' }] } })
    expect(await errorOf(saveReview(db, userId, 'article', item.id, 'de', { version: version + 5, segments: {} }))).toMatchObject({ statusCode: 409 })

    const other = await published()
    await translate(other.id, 'de')
    const taken = (await getArticle(db, other.id)).localizations.find(copy => copy.locale === 'de')!.slug
    expect(await errorOf(saveReview(db, userId, 'article', item.id, 'de', { version, segments: {}, slug: taken }))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'slug', message: 'slug_taken' }] } })
  })

  it('blocks approving while a segment came back broken, until someone translates it', async () => {
    const item = await published()
    await translate(item.id, 'fr', { breakTags: ['block:b'] })
    const review = await getReview(db, 'article', item.id, 'fr')
    expect(review.segments.find(segment => segment.id === 'block:b')).toMatchObject({ status: 'missing', translation: 'Segundo<b> forte</b>' })
    expect(review.missing).toEqual(['block:b'])
    expect(await errorOf(approveTranslation(db, userId, 'article', item.id, 'fr', review.target!.version))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'segments.block:b', message: 'missing' }] } })
    const saved = await saveReview(db, userId, 'article', item.id, 'fr', { version: review.target!.version, segments: { 'block:b': 'Deuxième<b> fort</b>' } })
    expect(saved.missing).toEqual([])
    expect((await approveTranslation(db, userId, 'article', item.id, 'fr', saved.target!.version)).target?.state).toBe('approved')
  })
})

describe('J-06: the source changes', () => {
  async function approvedEnglish() {
    const item = await published()
    await translate(item.id, 'en')
    const review = await getReview(db, 'article', item.id, 'en')
    await approveTranslation(db, userId, 'article', item.id, 'en', review.target!.version)
    return item
  }

  it('outdates only the edited block, and retranslating it calls the provider for that segment alone', async () => {
    const item = await approvedEnglish()
    const source = await sourceOf(item.id)
    await updateArticle(db, userId, await getArticle(db, item.id), { version: source.version, body: doc(['a', 'Primeiro'], ['b', 'Segundo, reescrito']) })
    const review = await getReview(db, 'article', item.id, 'en')
    expect(review.target?.state).toBe('outdated')
    expect(review.segments.filter(segment => segment.status !== 'ok').map(segment => segment.id)).toEqual(['block:b'])

    const provider = await translate(item.id, 'en', {}, ['block:b'])
    expect(provider.calls.flatMap(call => call.segments.map(segment => segment.id))).toEqual(['block:b'])
    const after = await getReview(db, 'article', item.id, 'en')
    expect(after.target?.state).toBe('in_review')
    expect(after.segments.find(segment => segment.id === 'block:b')).toMatchObject({ status: 'ok', translation: '[en] Segundo, reescrito<b>[en]  forte</b>' })
    // The rest stays as it was approved
    expect(after.segments.find(segment => segment.id === 'block:a')?.translation).toBe('[en] Primeiro<b>[en]  forte</b>')
    expect((await approveTranslation(db, userId, 'article', item.id, 'en', after.target!.version)).target?.state).toBe('approved')
  })

  it('rebuilds on the current source: a new block comes in missing, a removed one leaves', async () => {
    const item = await approvedEnglish()
    const source = await sourceOf(item.id)
    await updateArticle(db, userId, await getArticle(db, item.id), { version: source.version, body: doc(['a', 'Primeiro'], ['c', 'Terceiro, novo']) })
    const review = await getReview(db, 'article', item.id, 'en')
    expect(review.segments.map(segment => [segment.id, segment.status])).toEqual([['title', 'ok'], ['excerpt', 'ok'], ['block:a', 'ok'], ['block:c', 'missing']])
    const saved = await saveReview(db, userId, 'article', item.id, 'en', { version: review.target!.version, segments: { 'block:c': 'Third, new<b> strong</b>' } })
    const english = (await getArticle(db, item.id)).localizations.find(copy => copy.locale === 'en')!
    expect(english.body.content.map(block => (block.attrs as { id: string }).id)).toEqual(['a', 'c'])
    expect(saved.missing).toEqual([])
  })
})
