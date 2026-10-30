// F06-T5: the public blog on a real D1. Only published snapshots are read (never the working copy), per locale; an
// article published only in pt-BR is absent in other locales; pages of 10, newest first by first publication, and
// past the last a null (404); topics and related articles by topic; alternates of the published locales only
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { articles, users } from '../../server/db/schema'
import { allPublishedArticles } from '../../server/services/content/blog.repo'
import { blogArticle, blogPage, topicPage } from '../../server/services/content/blog.service'
import { createArticle, getArticle, updateArticle } from '../../server/services/content/articles.service'
import { createLocalization } from '../../server/services/content/localized.repo'
import { publishArticle, unpublishArticle } from '../../server/services/content/publishing.service'
import { createTopic } from '../../server/services/content/tags.service'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Blogger', email: `blogger-${uuidv7()}@example.test` }).returning()
const actor = { userId: user!.id, ip: null, ipHashSalt: undefined }
const unique = () => uuidv7().slice(-8)

/** A published pt-BR article; `firstPublishedAt` set so lists have a known order */
async function published(title: string, options: { tagIds?: string[], firstPublishedAt?: Date } = {}) {
  const article = await createArticle(db, user!.id, title)
  const saved = await updateArticle(db, user!.id, article, { version: 1, excerpt: `Resumo de ${title}`, ...(options.tagIds ? { tagIds: options.tagIds } : {}) })
  await publishArticle(db, actor, saved, 'pt-BR', 2)
  if (options.firstPublishedAt) {
    await db.update(articles).set({ firstPublishedAt: options.firstPublishedAt }).where(eq(articles.id, article.id))
  }
  return getArticle(db, article.id)
}

describe('public blog', () => {
  it('reads the published snapshot, never the working copy', async () => {
    const article = await published(`Publicado ${unique()}`)
    const slug = article.localizations[0]!.slug
    await updateArticle(db, user!.id, article, { version: 2, title: 'Rascunho que não foi publicado', excerpt: 'Ainda não' })
    const read = await blogArticle(db, 'pt-BR', slug)
    expect(read?.title).toBe(article.localizations[0]!.title)
    expect(read?.excerpt).toBe(`Resumo de ${article.localizations[0]!.title}`)
    expect(read?.cacheTags).toEqual(expect.arrayContaining([`article:${article.id}`, `article:${article.id}:pt-BR`, 'list:blog:pt-BR']))
    expect((await blogPage(db, 'pt-BR', 1))?.items.find(item => item.slug === slug)?.title).toBe(article.localizations[0]!.title)
  })

  it('keeps an article published only in pt-BR out of other locales', async () => {
    const article = await published(`Só português ${unique()}`)
    const slug = article.localizations[0]!.slug
    expect(await blogArticle(db, 'en', slug)).toBeNull()
    expect((await blogPage(db, 'en', 1))?.items.some(item => item.slug === slug)).toBe(false)
    expect((await blogArticle(db, 'pt-BR', slug))?.alternates).toEqual([{ locale: 'pt-BR', slug }])
    expect((await allPublishedArticles(db)).filter(row => row.articleId === article.id).map(row => row.locale)).toEqual(['pt-BR'])

    // With an approved and published translation, both locales list each other
    await createLocalization(db, 'article', { articleId: article.id, locale: 'de', title: 'Nur Deutsch', slug: `nur-deutsch-${unique()}`, body: { type: 'doc', content: [] }, translationState: 'approved' }, { coverMediaId: null, tagIds: [] })
    await publishArticle(db, actor, await getArticle(db, article.id), 'de', 1)
    const de = (await getArticle(db, article.id)).localizations.find(item => item.locale === 'de')!
    expect((await blogArticle(db, 'de', de.slug))?.alternates.map(item => item.locale)).toEqual(['de', 'pt-BR'])
    // Unpublished: gone everywhere
    await unpublishArticle(db, actor, await getArticle(db, article.id), 'pt-BR')
    expect(await blogArticle(db, 'pt-BR', slug)).toBeNull()
    expect(await blogArticle(db, 'de', de.slug)).toBeNull()
  })

  it('pages by 10, newest first publication first, with a null past the last page', async () => {
    const topic = await createTopic(db, user!.id, { name: `Paginação ${unique()}` })
    const base = Date.UTC(2030, 0, 1)
    const created = []
    for (let index = 0; index < 12; index++) {
      created.push(await published(`Página ${index} ${unique()}`, { tagIds: [topic.id], firstPublishedAt: new Date(base + index * 60_000) }))
    }
    const first = await topicPage(db, 'pt-BR', topic.slug, 1)
    expect(first).toMatchObject({ page: 1, pages: 2, total: 12, topic: { name: topic.name, slug: topic.slug } })
    expect(first!.items).toHaveLength(10)
    expect(first!.items[0]!.slug).toBe(created[11]!.localizations[0]!.slug)
    const second = await topicPage(db, 'pt-BR', topic.slug, 2)
    expect(second!.items.map(item => item.slug)).toEqual([created[1]!.localizations[0]!.slug, created[0]!.localizations[0]!.slug])
    expect(await topicPage(db, 'pt-BR', topic.slug, 3)).toBeNull()
    expect(await topicPage(db, 'en', topic.slug, 1)).toBeNull()
    expect(first!.cacheTags).toEqual(expect.arrayContaining([`tag:${topic.id}`, 'list:blog:pt-BR']))

    const index = await blogPage(db, 'pt-BR', 1)
    expect(index?.topics.find(item => item.slug === topic.slug)?.count).toBe(12)
    expect((await blogPage(db, 'pt-BR', 9999))).toBeNull()
    // The first page exists even with no article
    expect((await blogPage(db, 'fr', 1))?.items).toBeDefined()
  })

  it('relates articles that share a published topic, newest first, without itself', async () => {
    const topic = await createTopic(db, user!.id, { name: `Relacionado ${unique()}` })
    const other = await createTopic(db, user!.id, { name: `Outro ${unique()}` })
    const a = await published(`A ${unique()}`, { tagIds: [topic.id], firstPublishedAt: new Date(Date.UTC(2031, 0, 1)) })
    const b = await published(`B ${unique()}`, { tagIds: [topic.id], firstPublishedAt: new Date(Date.UTC(2031, 0, 2)) })
    await published(`C ${unique()}`, { tagIds: [other.id] })
    const read = await blogArticle(db, 'pt-BR', a.localizations[0]!.slug)
    expect(read?.related.map(item => item.slug)).toEqual([b.localizations[0]!.slug])
    expect(read?.topics).toEqual([{ name: topic.name, slug: topic.slug }])
  })
})
