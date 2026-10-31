// F09-T1: translation states on a real D1. Saving the pt-BR original marks outdated only the segments it changed, in
// approved translations (also ones approved before segments were tracked); machine and in-review copies are left
// alone; a save without a text change marks nothing. Publishing an outdated, machine or in-review copy is refused
// with its state. Topics, media texts and settings follow the same rule, and the site never shows a translation that
// is not approved. The dashboard summary counts the pending work per locale
import { env } from 'cloudflare:test'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { mediaLocalizations, siteSettingLocalizations, tagLocalizations, users } from '../../server/db/schema'
import type { media } from '../../server/db/schema'
import { createArticle, getArticle, updateArticle } from '../../server/services/content/articles.service'
import { topicsIn } from '../../server/services/content/blog.repo'
import { createLocalization } from '../../server/services/content/localized.repo'
import { getPage, updatePage } from '../../server/services/content/pages.service'
import { publishArticle } from '../../server/services/content/publishing.service'
import { createTopic, renameTag } from '../../server/services/content/tags.service'
import { findReadyMediaWithText, insertMedia, markReady } from '../../server/services/media/media.repo'
import { updateMediaMetadata } from '../../server/services/media/media.service'
import { publicSettings, updateSetting } from '../../server/services/settings/settings.service'
import { approvalMeta, translationSummary } from '../../server/services/translation/state.service'
import { articleSegments, pageSegments } from '../../shared/content/segment-hash'
import type { DocumentJson } from '../../shared/content/document-schema'
import type { TranslationState } from '../../shared/types/enums'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Tradução', email: `translation-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const actor = { userId, ip: null, ipHashSalt: undefined }
const unique = () => uuidv7().slice(-8)
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))
const copyOf = async (id: string, locale: string) => (await getArticle(db, id)).localizations.find(item => item.locale === locale)!

const body = (a: string, b: string): DocumentJson => ({
  type: 'doc',
  attrs: { schemaVersion: 1 },
  content: [
    { type: 'paragraph', attrs: { id: 'a' }, content: [{ type: 'text', text: a }] },
    { type: 'paragraph', attrs: { id: 'b' }, content: [{ type: 'text', text: b }] },
  ],
})

/** A published pt-BR article with one translation per given state, the approved one approved against the source */
async function article(states: Partial<Record<'en' | 'de' | 'fr', TranslationState>>, withMeta = true) {
  const draft = await createArticle(db, userId, `Artigo ${unique()}`)
  const saved = await updateArticle(db, userId, draft, { version: 1, excerpt: 'Resumo', body: body('Um', 'Dois') })
  const { article: published } = await publishArticle(db, actor, saved, 'pt-BR', 2)
  const source = published.localizations.find(item => item.locale === 'pt-BR')!
  const meta = await approvalMeta(articleSegments(source))
  for (const [locale, translationState] of Object.entries(states)) {
    await createLocalization(db, 'article', { articleId: draft.id, locale: locale as 'en', title: `T ${locale}`, slug: `t-${unique()}`, excerpt: 'E', body: body('One', 'Two'), translationState, segmentsMeta: withMeta && translationState === 'approved' ? meta : {} }, { coverMediaId: null, tagIds: [] })
  }
  return getArticle(db, draft.id)
}

describe('outdated by segment', () => {
  it('marks only the changed block outdated in an approved translation, and the localization outdated', async () => {
    const item = await article({ de: 'approved', en: 'machine', fr: 'in_review' })
    const source = item.localizations.find(copy => copy.locale === 'pt-BR')!
    await updateArticle(db, userId, item, { version: source.version, body: body('Um', 'Dois alterado') })

    const german = await copyOf(item.id, 'de')
    expect(german.translationState).toBe('outdated')
    expect(german.segmentsMeta['block:b']?.state).toBe('outdated')
    expect(german.segmentsMeta['block:a']?.state).toBe('approved')
    expect(german.segmentsMeta.title?.state).toBe('approved')
    expect(german.segmentsMeta.excerpt?.state).toBe('approved')
    // Work in progress is left alone; it gets reviewed anyway
    expect((await copyOf(item.id, 'en')).translationState).toBe('machine')
    expect((await copyOf(item.id, 'fr')).translationState).toBe('in_review')
  })

  it('takes the source before the save as the baseline of a translation approved before segments were tracked', async () => {
    const item = await article({ de: 'approved' }, false)
    const source = item.localizations.find(copy => copy.locale === 'pt-BR')!
    await updateArticle(db, userId, item, { version: source.version, excerpt: 'Resumo novo' })
    const german = await copyOf(item.id, 'de')
    expect(german.translationState).toBe('outdated')
    expect(Object.entries(german.segmentsMeta).filter(([, value]) => value.state === 'outdated').map(([id]) => id)).toEqual(['excerpt'])
  })

  it('marks nothing when the save changes no text', async () => {
    const item = await article({ de: 'approved' })
    const source = item.localizations.find(copy => copy.locale === 'pt-BR')!
    await updateArticle(db, userId, item, { version: source.version, noindex: true })
    expect((await copyOf(item.id, 'de')).translationState).toBe('approved')
  })

  it('marks the changed page field outdated, by its path', async () => {
    const page = await getPage(db, 'blog')
    const source = page.localizations.find(copy => copy.locale === 'pt-BR')!
    const saved = await updatePage(db, userId, page, { version: source.version, blocks: { title: 'Escritos', intro: 'Notas' } })
    const savedSource = saved.localizations.find(copy => copy.locale === 'pt-BR')!
    await createLocalization(db, 'page', { pageId: page.id, locale: 'es', blocks: { title: 'Escritos ES', intro: 'Notas ES' } as never, translationState: 'approved', segmentsMeta: await approvalMeta(pageSegments(savedSource)) }, {})
    await updatePage(db, userId, await getPage(db, 'blog'), { version: savedSource.version, blocks: { title: 'Escritos', intro: 'Notas novas' } })
    const spanish = (await getPage(db, 'blog')).localizations.find(copy => copy.locale === 'es')!
    expect(spanish.translationState).toBe('outdated')
    expect(spanish.segmentsMeta['blocks.intro']?.state).toBe('outdated')
    expect(spanish.segmentsMeta['blocks.title']?.state).toBe('approved')
  })
})

describe('publishing guard', () => {
  it('refuses an outdated, machine or in-review translation with its state', async () => {
    for (const state of ['outdated', 'machine', 'in_review'] as const) {
      const item = await article({ de: state })
      const german = item.localizations.find(copy => copy.locale === 'de')!
      expect(await errorOf(publishArticle(db, actor, item, 'de', german.version)), state).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'translationState', message: state }] } })
    }
  })
})

describe('topics, media texts and settings', () => {
  it('a renamed topic leaves its translated name outdated, and off the site in that locale', async () => {
    const topic = await createTopic(db, userId, { name: `Tema ${unique()}` })
    await db.insert(tagLocalizations).values({ tagId: topic.id, locale: 'de', name: 'Thema', slug: `thema-${unique()}`, translationState: 'approved' })
    expect(await topicsIn(db, 'de', [topic.id])).toHaveLength(1)
    await renameTag(db, userId, topic.id, { name: `Tema novo ${unique()}` })
    const [german] = await db.select().from(tagLocalizations).where(and(eq(tagLocalizations.tagId, topic.id), eq(tagLocalizations.locale, 'de')))
    expect(german).toMatchObject({ translationState: 'outdated', segmentsMeta: { name: { state: 'outdated' } } })
    expect(await topicsIn(db, 'de', [topic.id])).toEqual([])
  })

  it('a media translation waits in review unless its author may approve; a pt-BR change outdates approved ones', async () => {
    const hash = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')
    const row: typeof media.$inferInsert = { id: uuidv7(), kind: 'image', mimeType: 'image/jpeg', originalFilename: 'f.jpg', sizeBytes: 1, width: 10, height: 10, sha256: hash, originalKey: `originals/${hash}.jpg`, variants: [] }
    await insertMedia(db, row, [])
    await markReady(db, row.id!)
    await updateMediaMetadata(db, userId, row.id!, { localizations: { 'pt-BR': { alt: 'Um gato' }, 'en': { alt: 'A cat' } } }, false)
    const state = async (locale: string) => (await db.select().from(mediaLocalizations).where(and(eq(mediaLocalizations.mediaId, row.id!), eq(mediaLocalizations.locale, locale as 'en'))))[0]
    expect((await state('en'))?.translationState).toBe('in_review')
    expect((await findReadyMediaWithText(db, [row.id!])).localizations.map(item => item.locale)).toEqual(['pt-BR'])

    await updateMediaMetadata(db, userId, row.id!, { localizations: { de: { alt: 'Eine Katze' } } }, true)
    expect(await state('de')).toMatchObject({ translationState: 'approved', segmentsMeta: { alt: { state: 'approved' } } })
    await updateMediaMetadata(db, userId, row.id!, { localizations: { 'pt-BR': { alt: 'Um gato preto' } } }, true)
    expect(await state('de')).toMatchObject({ translationState: 'outdated', segmentsMeta: { alt: { state: 'outdated' } } })
    expect((await findReadyMediaWithText(db, [row.id!])).localizations.map(item => item.locale)).toEqual(['pt-BR'])
  })

  it('a pt-BR settings change outdates the other approved translations, and the site falls back to pt-BR', async () => {
    const first = await updateSetting(db, userId, 'footer', { version: 0, value: { showSocial: true }, localizations: { 'pt-BR': { text: 'Rodapé' }, 'fr': { text: 'Pied de page' } } })
    expect((await publicSettings(db, 'fr', 'http://x')).footer.text).toBe('Pied de page')
    await updateSetting(db, userId, 'footer', { version: first.version, value: { showSocial: true }, localizations: { 'pt-BR': { text: 'Rodapé novo' } } })
    const [french] = await db.select().from(siteSettingLocalizations).where(and(eq(siteSettingLocalizations.key, 'footer'), eq(siteSettingLocalizations.locale, 'fr')))
    expect(french).toMatchObject({ translationState: 'outdated', segmentsMeta: { text: { state: 'outdated' } } })
    expect((await publicSettings(db, 'fr', 'http://x')).footer.text).toBe('Rodapé novo')
  })
})

describe('dashboard summary', () => {
  it('counts the pending translations per entity and locale', async () => {
    const before = await translationSummary(db)
    const articles = (summary: typeof before, locale: 'en' | 'de' | 'fr' | 'es') => summary.rows.find(row => row.entity === 'article')!.locales[locale]
    await article({ de: 'machine', fr: 'outdated' })
    const after = await translationSummary(db)
    expect(after.locales).toEqual(['en', 'es', 'de', 'fr'])
    expect(articles(after, 'de').machine).toBe(articles(before, 'de').machine + 1)
    expect(articles(after, 'fr').outdated).toBe(articles(before, 'fr').outdated + 1)
    // A published article with no Spanish copy is missing in Spanish
    expect(articles(after, 'es').missing).toBe(articles(before, 'es').missing + 1)
    expect(after.rows.map(row => row.entity)).toEqual(['article', 'project', 'page', 'tag', 'media', 'setting'])
  })
})
