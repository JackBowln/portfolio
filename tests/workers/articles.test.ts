// F06-T1: articles and topics on a real D1. Creating picks a free slug; a save is one batch that updates the working
// copy, derived data, entity fields and media uses together, and a stale save (another tab saved first) changes
// nothing; slugs are unique per locale and freed by a soft delete; a published article and a used topic cannot be
// deleted
import { env } from 'cloudflare:test'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { articleLocalizations, articles, mediaUsages, users } from '../../server/db/schema'
import type { media } from '../../server/db/schema'
import { createArticle, deleteArticle, getArticle, listArticles, updateArticle } from '../../server/services/content/articles.service'
import { createRevision } from '../../server/services/content/revisions.repo'
import { createTopic, deleteTopic, listTopics, updateTopic } from '../../server/services/content/tags.service'
import { saveStatements } from '../../server/services/content/working-copy.repo'
import { insertMedia, markReady } from '../../server/services/media/media.repo'
import { contentHash } from '../../shared/content/canonical-json'
import type { DocumentJson } from '../../shared/content/document-schema'
import { snapshotOf } from '../../shared/content/snapshot'
import { articleUpdateSchema } from '../../shared/content/article-input'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Article tester', email: `articles-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const unique = () => uuidv7().slice(-8)
const sha = () => [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')

async function image(ready = true) {
  const hash = sha()
  const row: typeof media.$inferInsert = {
    id: uuidv7(),
    kind: 'image',
    mimeType: 'image/jpeg',
    originalFilename: 'foto.jpg',
    sizeBytes: 100,
    width: 1000,
    height: 750,
    sha256: hash,
    originalKey: `originals/${hash}.jpg`,
    variants: [],
  }
  await insertMedia(db, row, [])
  if (ready) {
    await markReady(db, row.id!)
  }
  return row.id!
}

const body = (mediaId?: string): DocumentJson => ({
  type: 'doc',
  attrs: { schemaVersion: 1 },
  content: [
    { type: 'heading', attrs: { id: 'h', level: 2 }, content: [{ type: 'text', text: 'Começo' }] },
    { type: 'paragraph', attrs: { id: 'p' }, content: [{ type: 'text', text: 'Um dois três quatro cinco' }] },
    ...(mediaId ? [{ type: 'image' as const, attrs: { id: 'i', mediaId, caption: null, altOverride: null } }] : []),
  ],
})

const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))
const ptBR = (article: Awaited<ReturnType<typeof getArticle>>) => article.localizations.find(item => item.locale === 'pt-BR')!
const usesOf = (articleId: string) => db.select({ mediaId: mediaUsages.mediaId, context: mediaUsages.context, locale: mediaUsages.locale }).from(mediaUsages)
  .where(and(eq(mediaUsages.entityType, 'article'), eq(mediaUsages.entityId, articleId)))

describe('creating', () => {
  it('makes a draft with a pt-BR working copy and a slug from the title, -2 when taken', async () => {
    const title = `Größe & Ação ${unique()}`
    const first = await createArticle(db, userId, title)
    const second = await createArticle(db, userId, title)
    expect(first.authorId).toBe(userId)
    expect(ptBR(first)).toMatchObject({ title, status: 'draft', translationState: 'source', version: 1, excerpt: '' })
    expect(ptBR(first).slug).toMatch(/^groesse-acao-[a-z0-9]+$/)
    expect(ptBR(second).slug).toBe(`${ptBR(first).slug}-2`)
    // The working hash is the hash of the snapshot a revision of this content would get
    expect(ptBR(first).workingHash).toBe(await contentHash(snapshotOf('article', { coverMediaId: null, tagIds: [] }, ptBR(first))))
  })

  it('handles titles whose slug is longer than D1\'s 50-byte LIKE limit', async () => {
    const title = `Um título relativamente longo para ver a quebra em telas estreitas ${unique()}`
    const first = await createArticle(db, userId, title)
    const second = await createArticle(db, userId, title)
    expect(ptBR(first).slug.length).toBeGreaterThan(50)
    expect(ptBR(second).slug).toBe(`${ptBR(first).slug}-2`)
  })

  it('falls back to "artigo" when the title has no letter or digit', async () => {
    const article = await createArticle(db, userId, '!!!')
    expect(ptBR(article).slug).toMatch(/^artigo(-\d+)?$/)
  })
})

describe('saving', () => {
  it('writes the working copy, derived data, entity fields and media uses in one go', async () => {
    const cover = await image()
    const photo = await image()
    const topic = await createTopic(db, userId, { name: `Tema ${unique()}` })
    const article = await createArticle(db, userId, `Salvar ${unique()}`)

    // Through the API's schema, which trims and turns blank SEO text into null
    const saved = await updateArticle(db, userId, article, articleUpdateSchema.parse({
      version: 1,
      title: 'Novo título',
      excerpt: 'Resumo',
      body: body(photo),
      seoDescription: '  ',
      coverMediaId: cover,
      ogImageMediaId: cover,
      tagIds: [topic.id],
      featured: true,
    }))
    const copy = ptBR(saved)
    expect(copy).toMatchObject({ title: 'Novo título', excerpt: 'Resumo', version: 2, wordCount: 6, readingTimeMin: 1, seoDescription: null })
    expect(copy.toc).toEqual([{ id: 'h', level: 2, text: 'Começo' }])
    expect(saved).toMatchObject({ coverMediaId: cover, tagIds: [topic.id], featured: true })
    expect(copy.workingHash).toBe(await contentHash(snapshotOf('article', { coverMediaId: cover, tagIds: [topic.id] }, copy)))
    expect((await usesOf(article.id)).sort((a, b) => a.context.localeCompare(b.context))).toEqual([
      { mediaId: photo, context: 'body', locale: 'pt-BR' },
      { mediaId: cover, context: 'cover', locale: null },
      { mediaId: cover, context: 'og', locale: 'pt-BR' },
    ])

    // Uses are replaced, not added to
    const again = await updateArticle(db, userId, saved, { version: 2, body: body(), coverMediaId: null, ogImageMediaId: null })
    expect(await usesOf(article.id)).toEqual([])
    expect(ptBR(again).version).toBe(3)
  })

  it('refuses a stale version and changes nothing', async () => {
    const cover = await image()
    const article = await createArticle(db, userId, `Versão ${unique()}`)
    const fresh = await updateArticle(db, userId, article, { version: 1, title: 'Primeira aba' })

    expect(await errorOf(updateArticle(db, userId, fresh, { version: 1, title: 'Segunda aba', coverMediaId: cover }))).toEqual({ statusCode: 409, data: { code: 'conflict', issues: [{ path: 'version', message: 'stale' }] } })
    const now = await getArticle(db, article.id)
    expect(ptBR(now)).toMatchObject({ title: 'Primeira aba', version: 2 })
    expect(now.coverMediaId).toBeNull()
  })

  it('leaves the entity and media uses alone when a racing save won the version', async () => {
    const cover = await image()
    const article = await createArticle(db, userId, `Corrida ${unique()}`)
    const copy = ptBR(article)
    await updateArticle(db, userId, article, { version: 1, title: 'Venceu' })
    // The loser's batch, built from version 1 after the winner's check had passed
    const [updated] = await db.batch(saveStatements(db, 'article', {
      entityId: article.id,
      localizationId: copy.id,
      version: 1,
      workingHash: 'loser',
      localization: { title: 'Perdeu' },
      entity: { coverMediaId: cover, updatedBy: userId },
      uses: [{ mediaId: cover, locale: null, context: 'cover' }],
    }))
    expect(updated).toEqual([])
    const now = await getArticle(db, article.id)
    expect(ptBR(now).title).toBe('Venceu')
    expect(now.coverMediaId).toBeNull()
    expect(await usesOf(article.id)).toEqual([])
  })

  it('keeps slugs unique per locale with a conflict on the field', async () => {
    const taken = await createArticle(db, userId, `Ocupado ${unique()}`)
    const other = await createArticle(db, userId, `Outro ${unique()}`)
    expect(await errorOf(updateArticle(db, userId, other, { version: 1, slug: ptBR(taken).slug }))).toEqual({ statusCode: 409, data: { code: 'conflict', issues: [{ path: 'slug', message: 'slug_taken' }] } })
    // Its own slug is not a conflict
    expect(ptBR(await updateArticle(db, userId, other, { version: 1, slug: ptBR(other).slug })).version).toBe(2)
  })

  it('checks covers, body media and topics before writing', async () => {
    const pending = await image(false)
    const article = await createArticle(db, userId, `Mídia ${unique()}`)
    const missing = uuidv7()
    expect(await errorOf(updateArticle(db, userId, article, { version: 1, coverMediaId: pending }))).toMatchObject({ statusCode: 400, data: { issues: [{ path: 'coverMediaId', message: 'must be a ready image' }] } })
    expect(await errorOf(updateArticle(db, userId, article, { version: 1, body: body(missing) }))).toMatchObject({ statusCode: 400, data: { issues: [{ path: 'body', message: `media ${missing} does not exist` }] } })
    expect(await errorOf(updateArticle(db, userId, article, { version: 1, tagIds: [missing] }))).toMatchObject({ statusCode: 400, data: { issues: [{ path: 'tagIds' }] } })
    expect(ptBR(await getArticle(db, article.id)).version).toBe(1)
  })
})

describe('deleting', () => {
  it('hides the article and frees its slug', async () => {
    const photo = await image()
    const article = await createArticle(db, userId, `Apagar ${unique()}`)
    const saved = await updateArticle(db, userId, article, { version: 1, body: body(photo) })
    await deleteArticle(db, userId, saved)
    expect(await errorOf(getArticle(db, article.id))).toMatchObject({ statusCode: 404 })
    expect(await usesOf(article.id)).toEqual([])
    const reused = await createArticle(db, userId, ptBR(article).title)
    expect(ptBR(reused).slug).toBe(ptBR(article).slug)
  })

  it('refuses while a localization is published', async () => {
    const article = await createArticle(db, userId, `Publicado ${unique()}`)
    const copy = ptBR(article)
    const snapshot = snapshotOf('article', { coverMediaId: null, tagIds: [] }, copy)
    const { revision } = await createRevision(db, 'article', { localizationId: copy.id, entityId: article.id, locale: 'pt-BR', kind: 'publish', snapshot })
    await db.update(articleLocalizations).set({ status: 'published', publishedRevisionId: revision.id, publishedSnapshot: snapshot, publishedSlug: copy.slug, publishedAt: new Date() }).where(eq(articleLocalizations.id, copy.id))
    expect(await errorOf(deleteArticle(db, userId, await getArticle(db, article.id)))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'status', message: 'published' }] } })
    const [row] = await db.select({ deletedAt: articles.deletedAt }).from(articles).where(eq(articles.id, article.id))
    expect(row?.deletedAt).toBeNull()
  })
})

describe('listing', () => {
  it('filters by a localization\'s status and pages by last change', async () => {
    const created = []
    for (let index = 0; index < 3; index++) {
      created.push(await createArticle(db, userId, `Lista ${unique()}`))
    }
    const first = await listArticles(db, { status: 'draft', locale: 'pt-BR' }, undefined, 2)
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()
    const second = await listArticles(db, { status: 'draft', locale: 'pt-BR' }, first.nextCursor!, 2)
    const seen = [...first.items, ...second.items].map(item => item.id)
    expect(new Set(seen).size).toBe(seen.length)
    expect(first.items[0]!.localizations[0]).toMatchObject({ locale: 'pt-BR', status: 'draft', translationState: 'source' })
    expect((await listArticles(db, { status: 'published' }, undefined, 50)).items.map(item => item.id)).not.toContain(created[0]!.id)
    expect((await listArticles(db, { locale: 'de' }, undefined, 50)).items).toEqual([])
    expect(await errorOf(listArticles(db, {}, 'not-a-cursor', 10))).toMatchObject({ statusCode: 400 })
  })
})

describe('topics', () => {
  it('creates, renames and counts uses; a used topic cannot be deleted', async () => {
    const name = `Acessibilidade ${unique()}`
    const topic = await createTopic(db, userId, { name })
    expect(topic.slug).toMatch(/^acessibilidade-/)
    expect(await errorOf(createTopic(db, userId, { name: 'Outro', slug: topic.slug }))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'slug' }] } })

    const article = await createArticle(db, userId, `Com tema ${unique()}`)
    await updateArticle(db, userId, article, { version: 1, tagIds: [topic.id] })
    expect((await listTopics(db)).find(item => item.id === topic.id)?.uses).toBe(1)
    expect(await errorOf(deleteTopic(db, topic.id))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'uses', message: '1' }] } })

    expect(await updateTopic(db, userId, topic.id, { name: 'Renomeado' })).toMatchObject({ name: 'Renomeado', slug: topic.slug })
    await updateArticle(db, userId, await getArticle(db, article.id), { version: 2, tagIds: [] })
    await deleteTopic(db, topic.id)
    expect((await listTopics(db)).find(item => item.id === topic.id)).toBeUndefined()
    expect(await errorOf(deleteTopic(db, topic.id))).toMatchObject({ statusCode: 404 })
  })
})
