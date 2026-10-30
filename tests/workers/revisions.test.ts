// F06-T2: autosave revisions, named versions, restore and the autosave prune on a real D1. Every save records an
// autosave in the same batch (repeats dropped, nothing on a stale save); a named version keeps its note; restoring
// copies a revision back and records a `restore`, deleting nothing; the prune keeps the newest 10 autosaves of a
// localization and none older than 14 days, and never touches other kinds or revisions a localization points at
import { env } from 'cloudflare:test'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { articleLocalizations, articleRevisions, users } from '../../server/db/schema'
import { createArticle, getArticle, getArticleRevision, listArticleRevisions, restoreArticleRevision, saveArticleVersion, updateArticle } from '../../server/services/content/articles.service'
import { isPruneWindow, pruneAutosaves } from '../../server/services/content/prune.repo'
import { createRevision } from '../../server/services/content/revisions.repo'
import { createTopic, deleteTopic } from '../../server/services/content/tags.service'
import { snapshotOf } from '../../shared/content/snapshot'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Revision tester', email: `revisions-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const unique = () => uuidv7().slice(-8)
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))
const ptBR = (article: Awaited<ReturnType<typeof getArticle>>) => article.localizations.find(item => item.locale === 'pt-BR')!
const kinds = async (articleId: string) => (await listArticleRevisions(db, await getArticle(db, articleId))).map(revision => revision.kind)

describe('autosave', () => {
  it('records an autosave with each save, drops repeats and records nothing on a stale save', async () => {
    const article = await createArticle(db, userId, `Autosave ${unique()}`)
    const first = await updateArticle(db, userId, article, { version: 1, title: 'Um' })
    expect(await kinds(article.id)).toEqual(['autosave'])
    // Same content again: the copy's version moves on, the history does not
    const same = await updateArticle(db, userId, first, { version: 2, title: 'Um' })
    expect(ptBR(same).version).toBe(3)
    expect(await kinds(article.id)).toEqual(['autosave'])

    await updateArticle(db, userId, same, { version: 3, title: 'Dois' })
    expect(await kinds(article.id)).toEqual(['autosave', 'autosave'])
    expect(await errorOf(updateArticle(db, userId, same, { version: 3, title: 'Três' }))).toMatchObject({ statusCode: 409 })
    expect(await kinds(article.id)).toEqual(['autosave', 'autosave'])

    // The autosave holds the saved content, and its hash is the working hash
    const [latest] = await listArticleRevisions(db, await getArticle(db, article.id))
    const revision = await getArticleRevision(db, await getArticle(db, article.id), latest!.id)
    expect(revision.snapshot.localization.title).toBe('Dois')
    expect(revision.authorName).toBe('Revision tester')
  })
})

describe('named versions', () => {
  it('keeps the note even when an autosave holds the content, and drops only an exact repeat', async () => {
    const article = await createArticle(db, userId, `Versão ${unique()}`)
    const saved = await updateArticle(db, userId, article, { version: 1, excerpt: 'Pronto para revisão' })
    const named = await saveArticleVersion(db, userId, saved, { version: 2, note: 'Antes da revisão' })
    expect(named).toMatchObject({ created: true, revision: { kind: 'manual', note: 'Antes da revisão', authorName: 'Revision tester' } })
    expect(await saveArticleVersion(db, userId, saved, { version: 2, note: 'Antes da revisão' })).toMatchObject({ created: false, revision: { id: named.revision.id } })
    expect((await saveArticleVersion(db, userId, saved, { version: 2, note: null })).created).toBe(true)
    expect(await kinds(article.id)).toEqual(['manual', 'manual', 'autosave'])
    expect(await errorOf(saveArticleVersion(db, userId, saved, { version: 1, note: null }))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'version' }] } })
  })
})

describe('restore', () => {
  it('copies a revision back, records a restore and deletes nothing', async () => {
    const topic = await createTopic(db, userId, { name: `Restaurar ${unique()}` })
    const gone = await createTopic(db, userId, { name: `Apagado ${unique()}` })
    const article = await createArticle(db, userId, `Restaurar ${unique()}`)
    const v2 = await updateArticle(db, userId, article, { version: 1, title: 'Original', excerpt: 'Resumo original', tagIds: [topic.id, gone.id] })
    const named = await saveArticleVersion(db, userId, v2, { version: 2, note: 'Boa versão' })
    const v3 = await updateArticle(db, userId, v2, { version: 2, title: 'Mudado', excerpt: 'Outro resumo', tagIds: [] })
    await deleteTopic(db, gone.id)
    const before = await listArticleRevisions(db, v3)

    const { article: restored, restored: number } = await restoreArticleRevision(db, userId, v3, { version: 3, revisionId: named.revision.id })
    expect(number).toBe(named.revision.number)
    expect(ptBR(restored)).toMatchObject({ title: 'Original', excerpt: 'Resumo original', version: 4 })
    // A topic deleted since the version is left out
    expect(restored.tagIds).toEqual([topic.id])
    const after = await listArticleRevisions(db, restored)
    expect(after).toHaveLength(before.length + 1)
    expect(after[0]).toMatchObject({ kind: 'restore', number: before[0]!.number + 1 })
    expect(after.slice(1).map(revision => revision.id)).toEqual(before.map(revision => revision.id))
  })

  it('refuses a stale version, a revision of another article and a slug taken meanwhile', async () => {
    const article = await createArticle(db, userId, `Conflito ${unique()}`)
    const first = await updateArticle(db, userId, article, { version: 1, title: 'Primeiro' })
    const [revision] = await listArticleRevisions(db, first)
    const moved = await updateArticle(db, userId, first, { version: 2, slug: `outro-${unique()}` })
    expect(await errorOf(restoreArticleRevision(db, userId, moved, { version: 2, revisionId: revision!.id }))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'version' }] } })

    const other = await createArticle(db, userId, `Outro ${unique()}`)
    await updateArticle(db, userId, other, { version: 1, title: 'Outro' })
    const [foreign] = await listArticleRevisions(db, await getArticle(db, other.id))
    expect(await errorOf(restoreArticleRevision(db, userId, moved, { version: 3, revisionId: foreign!.id }))).toMatchObject({ statusCode: 404 })

    // The original slug now belongs to a new article
    const squatter = await createArticle(db, userId, ptBR(article).title)
    expect(ptBR(squatter).slug).toBe(ptBR(article).slug)
    expect(await errorOf(restoreArticleRevision(db, userId, moved, { version: 3, revisionId: revision!.id }))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'slug' }] } })
    expect(ptBR(await getArticle(db, article.id)).version).toBe(3)
  })
})

describe('autosave prune', () => {
  it('runs once a day, in the 5 minutes after 03:00 UTC, of a cron that fires every 5 minutes', () => {
    const at = (time: string) => isPruneWindow(new Date(`2026-10-30T${time}Z`))
    expect([at('03:00:00'), at('03:04:59')]).toEqual([true, true])
    expect([at('02:59:59'), at('03:05:00'), at('15:00:00'), at('00:00:00')]).toEqual([false, false, false, false])
  })

  it('keeps the newest 10 autosaves, none older than 14 days, and never other kinds or pointed-at revisions', async () => {
    const article = await createArticle(db, userId, `Poda ${unique()}`)
    const copy = ptBR(article)
    const base = { localizationId: copy.id, entityId: article.id, locale: 'pt-BR' as const }
    const snapshot = (title: string) => snapshotOf('article', { coverMediaId: null, tagIds: [] }, { ...copy, title })
    const day = 24 * 60 * 60 * 1000
    const now = new Date()
    const made: { id: string, kind: string, ageDays: number }[] = []
    // Oldest first: 4 autosaves 20 days old (one of them published), a manual 30 days old, then 13 recent autosaves
    for (let index = 0; index < 18; index++) {
      const kind = index === 4 ? 'manual' : 'autosave'
      const ageDays = index < 5 ? (index === 4 ? 30 : 20) : 1
      const { revision } = await createRevision(db, 'article', { ...base, kind, snapshot: snapshot(`T${index}`) })
      await db.update(articleRevisions).set({ createdAt: new Date(now.getTime() - ageDays * day) }).where(eq(articleRevisions.id, revision.id))
      made.push({ id: revision.id, kind, ageDays })
    }
    const published = made[1]!
    await db.update(articleLocalizations).set({ status: 'published', publishedRevisionId: published.id, publishedSnapshot: snapshot('T1'), publishedSlug: copy.slug, publishedAt: now }).where(eq(articleLocalizations.id, copy.id))

    // A bounded run deletes at most `limit` rows
    expect(await pruneAutosaves(db, 'article', now, 2)).toBe(2)
    await pruneAutosaves(db, 'article', now, 500)
    expect(await pruneAutosaves(db, 'article', now, 500)).toBe(0)

    const left = await db.select({ id: articleRevisions.id, kind: articleRevisions.kind }).from(articleRevisions)
      .where(and(eq(articleRevisions.localizationId, copy.id)))
    const ids = new Set(left.map(row => row.id))
    const recent = made.filter(item => item.kind === 'autosave' && item.ageDays === 1)
    // The 10 newest recent autosaves stay; the 3 older recent ones go (rank > 10), and so do the 20-day-old ones
    expect(recent.slice(-10).every(item => ids.has(item.id))).toBe(true)
    expect(recent.slice(0, 3).some(item => ids.has(item.id))).toBe(false)
    expect(made.filter(item => item.ageDays === 20 && item !== published).some(item => ids.has(item.id))).toBe(false)
    // Kept whatever their age: the manual version and the published autosave
    expect(ids.has(made[4]!.id)).toBe(true)
    expect(ids.has(published.id)).toBe(true)
  })
})
