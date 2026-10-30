// F05-T1: the content tables (migration 0004) and the shared localization and revision repositories on a real D1:
// slug uniqueness per locale, the one-query public read, keyset lists, hash deduplication of revisions and the gzip
// round trip (data-model §4, §9, §10). Publishing here is a direct update: the rules come in F06-T4
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { articleLocalizations, articleRevisions, articles, pages, projects, users } from '../../server/db/schema'
import { createLocalization, getLocalization, getPublishedBySlug, listPublished, listPublishedAlternates } from '../../server/services/content/localized.repo'
import type { LocalizationRow } from '../../server/services/content/localized.repo'
import { createRevision, getRevision, listRevisions } from '../../server/services/content/revisions.repo'
import { contentHash } from '../../shared/content/canonical-json'
import { decodePublishedCursor } from '../../shared/content/cursor'
import { snapshotOf } from '../../shared/content/snapshot'
import type { DocumentJson } from '../../shared/content/snapshot'
import type { Locale } from '../../shared/types/enums'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Content tester', email: `content-${uuidv7()}@example.test` }).returning()
const authorId = user!.id
const unique = () => uuidv7().slice(-12)
const doc = (text: string): DocumentJson => ({ type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text }] }] })
const NO_ENTITY = { coverMediaId: null, tagIds: [] }

async function article() {
  const [row] = await db.insert(articles).values({ authorId }).returning()
  return row!
}

async function localization(articleId: string, locale: Locale, overrides: Partial<{ slug: string, title: string, body: DocumentJson }> = {}) {
  return createLocalization(db, 'article', {
    articleId,
    locale,
    title: overrides.title ?? 'Título',
    slug: overrides.slug ?? `artigo-${unique()}`,
    body: overrides.body ?? doc('Olá'),
    translationState: locale === 'pt-BR' ? 'source' : 'in_review',
  }, NO_ENTITY)
}

/** What F06-T4 will do in a batch: a publish revision, then the published_* copy */
async function publish(row: LocalizationRow<'article'>, publishedAt = new Date()) {
  const snapshot = snapshotOf('article', NO_ENTITY, row)
  const { revision } = await createRevision(db, 'article', { localizationId: row.id, entityId: row.articleId, locale: row.locale, kind: 'publish', snapshot })
  await db.update(articleLocalizations).set({
    status: 'published',
    publishedRevisionId: revision.id,
    publishedSnapshot: snapshot,
    publishedSlug: row.slug,
    publishedTitle: row.title,
    publishedExcerpt: row.excerpt,
    publishedReadingTimeMin: 1,
    publishedAt,
  }).where(eq(articleLocalizations.id, row.id))
  return revision
}

/** A D1 binding that counts the statements sent through it */
function countingDb() {
  const counter = { statements: 0 }
  const d1 = new Proxy(env.DB, {
    get(target, property) {
      const value = Reflect.get(target, property) as unknown
      if (property === 'prepare') {
        return (query: string) => {
          counter.statements++
          return target.prepare(query)
        }
      }
      if (property === 'batch' || property === 'exec') {
        throw new Error(`${String(property)} is not expected in a public read`)
      }
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  return { db: createDb(d1), counter }
}

/** Drizzle wraps the D1 error ("Failed query: …"); the constraint that failed is in its cause */
async function rejects(promise: Promise<unknown>, pattern: RegExp) {
  const error = await promise.then(() => null, (reason: unknown) => reason as Error & { cause?: Error })
  expect(error, `expected ${pattern}`).not.toBeNull()
  expect(`${error!.message}\n${error!.cause?.message ?? ''}`).toMatch(pattern)
}

describe('constraints', () => {
  it('allows one localization per article and locale', async () => {
    const { id } = await article()
    await localization(id, 'pt-BR')
    await rejects(localization(id, 'pt-BR'), /UNIQUE constraint failed: article_localizations\.article_id, article_localizations\.locale/)
  })

  it('keeps (locale, slug) unique among live rows, per locale and per content type', async () => {
    const slug = `mesmo-${unique()}`
    const first = await localization((await article()).id, 'pt-BR', { slug })
    await rejects(localization((await article()).id, 'pt-BR', { slug }), /UNIQUE constraint failed: article_localizations\.locale, article_localizations\.slug/)
    // Another locale and another content type may use it
    await localization((await article()).id, 'en', { slug })
    const [project] = await db.insert(projects).values({}).returning()
    await createLocalization(db, 'project', { projectId: project!.id, locale: 'pt-BR', title: 'P', slug, body: doc('p'), translationState: 'source' }, {
      coverMediaId: null, galleryMediaIds: [], technologyIds: [], periodStart: null, periodEnd: null, repoUrl: null, demoUrl: null,
    })
    // A soft-deleted row frees the slug
    await db.update(articleLocalizations).set({ deletedAt: new Date() }).where(eq(articleLocalizations.id, first.id))
    await localization((await article()).id, 'pt-BR', { slug })
  })

  it('keeps (locale, published_slug) unique among published rows', async () => {
    const slug = `publicado-${unique()}`
    await publish(await localization((await article()).id, 'en', { slug }))
    const other = await localization((await article()).id, 'en', { slug: `outro-${unique()}` })
    await rejects(publish({ ...other, slug }), /UNIQUE constraint failed: article_localizations\.locale, article_localizations\.published_slug/)
  })

  it('ties the source state to pt-BR, a schedule to its date and the published columns to the revision', async () => {
    const { id } = await article()
    await rejects(createLocalization(db, 'article', { articleId: id, locale: 'en', title: 'T', slug: `s-${unique()}`, body: doc('x'), translationState: 'source' }, NO_ENTITY), /CHECK constraint failed: article_localizations_source_check/)
    await rejects(createLocalization(db, 'article', { articleId: id, locale: 'pt-BR', title: 'T', slug: `s-${unique()}`, body: doc('x'), translationState: 'missing' }, NO_ENTITY), /CHECK constraint failed: article_localizations_source_check/)
    const row = await localization(id, 'pt-BR')
    await rejects(db.update(articleLocalizations).set({ status: 'scheduled' }).where(eq(articleLocalizations.id, row.id)), /CHECK constraint failed: article_localizations_scheduled_check/)
    await rejects(db.update(articleLocalizations).set({ publishedSlug: row.slug }).where(eq(articleLocalizations.id, row.id)), /CHECK constraint failed: article_localizations_published/)
  })

  it('refuses a revision of a localization that does not exist', async () => {
    const { id } = await article()
    await rejects(createRevision(db, 'article', { localizationId: uuidv7(), entityId: id, locale: 'pt-BR', kind: 'manual', snapshot: snapshotOf('article', NO_ENTITY, { title: 'T', slug: 't', body: doc('x') }) }), /FOREIGN KEY constraint failed/)
  })

  it('refuses a body that is not a valid document (F05-T2 schema)', async () => {
    const { id } = await article()
    const values = { articleId: id, locale: 'pt-BR' as const, title: 'T', slug: `s-${unique()}`, translationState: 'source' as const }
    await rejects(createLocalization(db, 'article', { ...values, body: { type: 'html' } as never }, NO_ENTITY), /Invalid input/)
    const hostile = { type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }
    await rejects(createLocalization(db, 'article', { ...values, body: hostile as never }, NO_ENTITY), /link must be https:/)
    // The column itself validates, whatever wrote the value
    const row = await localization(id, 'pt-BR')
    await rejects(db.update(articleLocalizations).set({ body: hostile as never }).where(eq(articleLocalizations.id, row.id)), /link must be https:/)
  })
})

describe('public reads', () => {
  it('reads a published article by (locale, published_slug) in one statement, from the published copy only', async () => {
    const row = await localization((await article()).id, 'pt-BR', { title: 'Publicado', body: doc('versão no ar') })
    const revision = await publish(row)
    // Later edits to the working copy never reach the public read
    await db.update(articleLocalizations).set({ title: 'Rascunho novo', body: doc('rascunho') }).where(eq(articleLocalizations.id, row.id))

    const { db: counted, counter } = countingDb()
    const found = await getPublishedBySlug(counted, 'article', 'pt-BR', row.slug)
    expect(counter.statements).toBe(1)
    expect(found).toMatchObject({ id: row.id, entityId: row.articleId, locale: 'pt-BR', publishedRevisionId: revision.id })
    expect(found!.snapshot.localization).toMatchObject({ title: 'Publicado', body: doc('versão no ar') })
    expect(found!.publishedAt).toBeInstanceOf(Date)
  })

  it('hides drafts, other locales, deleted localizations and deleted articles', async () => {
    const draft = await localization((await article()).id, 'pt-BR')
    expect(await getPublishedBySlug(db, 'article', 'pt-BR', draft.slug)).toBeUndefined()

    const live = await localization((await article()).id, 'pt-BR')
    await publish(live)
    expect(await getPublishedBySlug(db, 'article', 'en', live.slug)).toBeUndefined()
    await db.update(articles).set({ deletedAt: new Date() }).where(eq(articles.id, live.articleId))
    expect(await getPublishedBySlug(db, 'article', 'pt-BR', live.slug)).toBeUndefined()

    const removed = await localization((await article()).id, 'pt-BR')
    await publish(removed)
    await db.update(articleLocalizations).set({ deletedAt: new Date() }).where(eq(articleLocalizations.id, removed.id))
    expect(await getPublishedBySlug(db, 'article', 'pt-BR', removed.slug)).toBeUndefined()
    expect(await getLocalization(db, 'article', removed.articleId, 'pt-BR')).toBeUndefined()
  })

  it('lists the published locales of an article as alternates', async () => {
    const { id } = await article()
    const pt = await localization(id, 'pt-BR')
    const en = await localization(id, 'en')
    await localization(id, 'es')
    await publish(pt)
    await publish(en)
    expect(await listPublishedAlternates(db, 'article', id)).toEqual([{ locale: 'en', slug: en.slug }, { locale: 'pt-BR', slug: pt.slug }])
  })

  it('pages the list newest first with a stable cursor, ties on published_at broken by id', async () => {
    // A locale of its own, so rows from other tests do not interleave
    const locale: Locale = 'fr'
    const base = Date.UTC(2031, 0, 1)
    const times = [base + 3000, base + 2000, base + 2000, base + 2000, base + 1000]
    const published: string[] = []
    for (const time of times) {
      const row = await localization((await article()).id, locale)
      await publish(row, new Date(time))
      published.push(row.id)
    }
    await localization((await article()).id, locale) // a draft, never listed

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const page: Awaited<ReturnType<typeof listPublished>> = await listPublished(db, 'article', locale, { cursor: cursor ? decodePublishedCursor(cursor)! : undefined, limit: 2 })
      expect(page.items.length).toBeLessThanOrEqual(2)
      seen.push(...page.items.map(item => item.id))
      cursor = page.nextCursor
    } while (cursor)

    const expected = published.map((id, index) => ({ id, time: times[index]! }))
      .sort((a, b) => b.time - a.time || (a.id < b.id ? 1 : -1)).map(item => item.id)
    expect(seen).toEqual(expected)
  })

  it('uses the list index', async () => {
    const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN SELECT id FROM article_localizations WHERE locale = 'pt-BR' AND published_revision_id IS NOT NULL ORDER BY published_at DESC, id DESC LIMIT 12`).all<{ detail: string }>()
    expect(plan.results.map(step => step.detail).join('\n')).toContain('article_localizations_published_idx')
    const detail = await env.DB.prepare(`EXPLAIN QUERY PLAN SELECT id FROM article_localizations WHERE locale = 'pt-BR' AND published_slug = 'x' AND published_revision_id IS NOT NULL`).all<{ detail: string }>()
    expect(detail.results.map(step => step.detail).join('\n')).toContain('article_localizations_locale_published_slug_unique')
  })
})

describe('revisions', () => {
  it('numbers revisions per localization and skips an autosave identical to the latest', async () => {
    const row = await localization((await article()).id, 'pt-BR')
    const base = { localizationId: row.id, entityId: row.articleId, locale: row.locale }
    const snapshot = snapshotOf('article', NO_ENTITY, row)

    const first = await createRevision(db, 'article', { ...base, kind: 'autosave', snapshot })
    expect(first).toMatchObject({ created: true, revision: { number: 1, kind: 'autosave' } })
    // The hash is the working hash of the same content
    expect(first.revision.contentHash).toBe(row.workingHash)
    expect(first.revision.contentHash).toBe(await contentHash(snapshot))

    // Same content with keys in another order: no new revision
    const reordered = { localization: { ...Object.fromEntries(Object.entries(snapshot.localization).reverse()) }, entity: snapshot.entity }
    expect(await createRevision(db, 'article', { ...base, kind: 'autosave', snapshot: reordered as typeof snapshot })).toEqual({ created: false, revision: first.revision })
    // F06-T2, decision 3: a manual version is kept even when an autosave holds its content; only a repeat of the
    // latest manual version with the same note is dropped
    const manual = await createRevision(db, 'article', { ...base, kind: 'manual', snapshot, note: 'Antes da revisão' })
    expect(manual).toMatchObject({ created: true, revision: { number: 2, kind: 'manual', note: 'Antes da revisão' } })
    expect(await createRevision(db, 'article', { ...base, kind: 'manual', snapshot, note: 'Antes da revisão' })).toEqual({ created: false, revision: manual.revision })
    expect(await createRevision(db, 'article', { ...base, kind: 'manual', snapshot, note: 'Outra nota' })).toMatchObject({ created: true, revision: { number: 3 } })

    // Publish always records its event
    const published = await createRevision(db, 'article', { ...base, kind: 'publish', snapshot })
    expect(published).toMatchObject({ created: true, revision: { number: 4, kind: 'publish' } })

    const changed = { ...snapshot, localization: { ...snapshot.localization, title: 'Outro título' } }
    const third = await createRevision(db, 'article', { ...base, kind: 'autosave', snapshot: changed, note: null })
    expect(third).toMatchObject({ created: true, revision: { number: 5 } })
    // An autosave that goes back to older content is new again: only the latest counts
    expect(await createRevision(db, 'article', { ...base, kind: 'autosave', snapshot })).toMatchObject({ created: true, revision: { number: 6 } })

    expect((await listRevisions(db, 'article', row.id)).map(revision => revision.number)).toEqual([6, 5, 4, 3, 2, 1])
    // Numbers restart for another localization
    const other = await localization(row.articleId, 'en')
    expect((await createRevision(db, 'article', { localizationId: other.id, entityId: other.articleId, locale: 'en', kind: 'manual', snapshot: snapshotOf('article', NO_ENTITY, other) })).revision.number).toBe(1)
  })

  it('stores the snapshot compressed and reads it back without loss', async () => {
    const text = 'Conteúdo com acentuação, emoji 😀, aspas "duplas" e \u2028 separadores. '.repeat(20)
    const body: DocumentJson = { type: 'doc', content: Array.from({ length: 40 }, (_, index) => ({ type: 'paragraph', attrs: { id: `p${index}` }, content: [{ type: 'text', text }] })) }
    const row = await localization((await article()).id, 'pt-BR', { body })
    const snapshot = snapshotOf('article', { coverMediaId: null, tagIds: ['t1', 't2'] }, row)

    const started = performance.now()
    const { revision } = await createRevision(db, 'article', { localizationId: row.id, entityId: row.articleId, locale: 'pt-BR', kind: 'manual', snapshot, note: 'Versão longa' })
    const elapsed = performance.now() - started

    const [stored] = await db.select({ snapshotGz: articleRevisions.snapshotGz }).from(articleRevisions).where(eq(articleRevisions.id, revision.id))
    const jsonBytes = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength
    expect(stored!.snapshotGz).toBeInstanceOf(Uint8Array)
    // gzip magic number
    expect([...stored!.snapshotGz.subarray(0, 2)]).toEqual([0x1F, 0x8B])
    expect(stored!.snapshotGz.byteLength).toBeLessThan(jsonBytes / 5)
    console.log(`[F05-T1] snapshot ${jsonBytes} B → ${stored!.snapshotGz.byteLength} B gzip; createRevision ${elapsed.toFixed(1)} ms in workerd (miniflare)`)

    const read = await getRevision(db, 'article', row.id, revision.id)
    expect(read).toMatchObject({ number: 1, kind: 'manual', note: 'Versão longa' })
    expect(read!.snapshot).toEqual(snapshot)
    // Scoped to its localization
    expect(await getRevision(db, 'article', uuidv7(), revision.id)).toBeUndefined()
  })

  it('serves pages through the same repositories', async () => {
    const [page] = await db.insert(pages).values({ key: 'privacy' }).returning()
    const row = await createLocalization(db, 'page', { pageId: page!.id, locale: 'pt-BR', blocks: { body: { type: 'doc', content: [] } }, translationState: 'source' }, {})
    expect(await getLocalization(db, 'page', page!.id, 'pt-BR')).toMatchObject({ id: row.id, blocks: { body: { type: 'doc', content: [] } }, noindex: false })
    const { revision } = await createRevision(db, 'page', { localizationId: row.id, entityId: page!.id, locale: 'pt-BR', kind: 'manual', snapshot: snapshotOf('page', {}, row) })
    expect(revision.contentHash).toBe(row.workingHash)
    expect((await getRevision(db, 'page', row.id, revision.id))!.snapshot.localization.blocks).toEqual({ body: { type: 'doc', content: [] } })
  })
})
