// F11-T3: what feeds the sitemap, on a real D1. Articles, projects and institutional pages published with noindex
// stay out; topics come with the locales where they have a name and a published article, with the newest article's
// date, and a topic page lists those locales as its alternates
import { env } from 'cloudflare:test'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { users } from '../../server/db/schema'
import { tagLocalizations } from '../../server/db/schema/taxonomy'
import { createArticle, getArticle, updateArticle } from '../../server/services/content/articles.service'
import { allPublishedArticles, publishedTopics } from '../../server/services/content/blog.repo'
import { topicPage } from '../../server/services/content/blog.service'
import { createLocalization } from '../../server/services/content/localized.repo'
import { publishedPageLocales } from '../../server/services/content/pages.repo'
import { getPage, publishPage, updatePage } from '../../server/services/content/pages.service'
import { createProject, publishProject, updateProject } from '../../server/services/content/projects.service'
import { allPublishedProjects } from '../../server/services/content/projects-public.repo'
import { publishArticle } from '../../server/services/content/publishing.service'
import { createTopic } from '../../server/services/content/tags.service'
import { EMPTY_PAGE_BLOCKS } from '../../shared/pages/blocks'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Mapa', email: `sitemap-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const actor = { userId, ip: null, ipHashSalt: undefined }
const unique = () => uuidv7().slice(-8)

async function published(changes: { noindex?: boolean, tagIds?: string[] } = {}) {
  const draft = await createArticle(db, userId, `Mapa ${unique()}`)
  const saved = await updateArticle(db, userId, draft, { version: 1, excerpt: 'Resumo', ...changes })
  return (await publishArticle(db, actor, saved, 'pt-BR', 2)).article
}

describe('sitemap sources', () => {
  it('leave out what was published with noindex', async () => {
    const indexable = await published()
    const hidden = await published({ noindex: true })
    const ids = (await allPublishedArticles(db)).map(row => row.articleId)
    expect(ids).toContain(indexable.id)
    expect(ids).not.toContain(hidden.id)

    const project = await createProject(db, userId, `Projeto ${unique()}`)
    const saved = await updateProject(db, userId, project, { version: 1, noindex: true })
    await publishProject(db, actor, saved, 'pt-BR', 2)
    expect((await allPublishedProjects(db)).map(row => row.projectId)).not.toContain(project.id)

    // An institutional page: out with noindex, in once published without it
    const page = await getPage(db, 'privacy')
    const source = () => page.localizations.find(copy => copy.locale === 'pt-BR')!
    const hiddenPage = await updatePage(db, userId, page, { version: source().version, blocks: EMPTY_PAGE_BLOCKS.privacy, noindex: true })
    const hiddenCopy = hiddenPage.localizations.find(copy => copy.locale === 'pt-BR')!
    const { page: after } = await publishPage(db, actor, hiddenPage, 'pt-BR', hiddenCopy.version)
    expect(await publishedPageLocales(db, ['privacy'])).toEqual([])
    const shown = await updatePage(db, userId, after, { version: after.localizations.find(copy => copy.locale === 'pt-BR')!.version, noindex: false })
    await publishPage(db, actor, shown, 'pt-BR', shown.localizations.find(copy => copy.locale === 'pt-BR')!.version)
    expect((await publishedPageLocales(db, ['privacy'])).map(row => row.locale)).toEqual(['pt-BR'])
  })

  it('list a topic where it has a name and a published article, linked across those locales', async () => {
    const topic = await createTopic(db, userId, { name: `Tema ${unique()}` })
    const article = await published({ tagIds: [topic.id] })
    const ptSlug = (await publishedTopics(db, topic.id))[0]!.slug
    expect(await publishedTopics(db, topic.id)).toEqual([{ tagId: topic.id, locale: 'pt-BR', slug: ptSlug, publishedAt: expect.any(Date) }])

    // A German name in review does not count; approved, with a German article, it does
    await db.insert(tagLocalizations).values({ tagId: topic.id, locale: 'de', name: 'Thema', slug: `thema-${unique()}`, translationState: 'in_review' })
    await createLocalization(db, 'article', { articleId: article.id, locale: 'de', title: 'Artikel', slug: `artikel-${unique()}`, body: { type: 'doc', content: [] }, translationState: 'approved' }, { coverMediaId: null, tagIds: [topic.id] })
    await publishArticle(db, actor, await getArticle(db, article.id), 'de', 1)
    expect((await publishedTopics(db, topic.id)).map(row => row.locale)).toEqual(['pt-BR'])
    await db.update(tagLocalizations).set({ translationState: 'approved' }).where(eqTag(topic.id, 'de'))
    const rows = await publishedTopics(db, topic.id)
    expect(rows.map(row => row.locale)).toEqual(['de', 'pt-BR'])

    const page = await topicPage(db, 'pt-BR', ptSlug, 1)
    expect(page?.alternates.map(item => item.locale)).toEqual(['de', 'pt-BR'])
    expect(page?.alternates.find(item => item.locale === 'de')?.slug).toBe(rows.find(row => row.locale === 'de')!.slug)
  })
})

function eqTag(tagId: string, locale: 'de') {
  return and(eq(tagLocalizations.tagId, tagId), eq(tagLocalizations.locale, locale))
}
