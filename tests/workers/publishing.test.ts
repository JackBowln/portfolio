// F06-T4: publishing on a real D1. Transitions and guards (translations need `approved` and a published pt-BR;
// informative images need alt), an atomic publish batch (a real failure in the middle leaves nothing), redirects
// without chains or loops, unpublishing a pt-BR with its translations, scheduling, and the cron with a fake clock:
// due items publish once, even when the cron runs twice
import { env } from 'cloudflare:test'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { articleLocalizations, articleTags, auditLog, mediaLocalizations, redirects, users } from '../../server/db/schema'
import type { media } from '../../server/db/schema'
import { createArticle, getArticle, listArticleRevisions, updateArticle } from '../../server/services/content/articles.service'
import { createLocalization } from '../../server/services/content/localized.repo'
import { publishArticle, publishDue, scheduleArticle, unpublishArticle, unscheduleArticle } from '../../server/services/content/publishing.service'
import { createTopic } from '../../server/services/content/tags.service'
import { insertMedia, markReady } from '../../server/services/media/media.repo'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Publisher', email: `publisher-${uuidv7()}@example.test` }).returning()
const actor = { userId: user!.id, ip: null, ipHashSalt: undefined }
const unique = () => uuidv7().slice(-8)
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))
const copyOf = async (id: string, locale = 'pt-BR') => (await getArticle(db, id)).localizations.find(item => item.locale === locale)!
const sha = () => [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')

async function image(alt: string | null, decorative = false) {
  const hash = sha()
  const row: typeof media.$inferInsert = { id: uuidv7(), kind: 'image', mimeType: 'image/jpeg', originalFilename: 'f.jpg', sizeBytes: 1, width: 10, height: 10, sha256: hash, originalKey: `originals/${hash}.jpg`, variants: [], decorative }
  await insertMedia(db, row, [])
  await markReady(db, row.id!)
  if (alt !== null) {
    await db.insert(mediaLocalizations).values({ mediaId: row.id!, locale: 'pt-BR', alt, translationState: 'source' })
  }
  return row.id!
}

async function draft(title = `Artigo ${unique()}`) {
  return createArticle(db, user!.id, title)
}

describe('publish', () => {
  it('publishes atomically: revision, pointer, published fields, topics, first date and audit; purges ADR-0003 tags', async () => {
    const topic = await createTopic(db, user!.id, { name: `Publicar ${unique()}` })
    const article = await draft()
    const saved = await updateArticle(db, user!.id, article, { version: 1, excerpt: 'Resumo', tagIds: [topic.id] })
    const { article: published, purge } = await publishArticle(db, actor, saved, 'pt-BR', 2)
    const copy = published.localizations[0]!
    expect(copy).toMatchObject({ status: 'published', publishedSlug: copy.slug, publishedTitle: copy.title, publishedExcerpt: 'Resumo', version: 2 })
    expect(copy.publishedSnapshot?.localization.title).toBe(copy.title)
    expect((await listArticleRevisions(db, published))[0]).toMatchObject({ kind: 'publish' })
    expect(await db.select().from(articleTags).where(eq(articleTags.articleId, article.id))).toEqual([{ articleId: article.id, tagId: topic.id }])
    expect(purge).toEqual([`article:${article.id}:pt-BR`, 'list:blog:pt-BR', 'sitemap', 'rss:pt-BR', `tag:${topic.id}`])
    const audit = await db.select().from(auditLog).where(and(eq(auditLog.entityId, article.id), eq(auditLog.action, 'article.published')))
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ actorUserId: user!.id, locale: 'pt-BR' })
  })

  it('rolls everything back when the batch fails in the middle', async () => {
    // A is on the site as "x"; its working slug moves on, so B may take "x" as a working slug
    const slug = `ocupado-${unique()}`
    const a = await draft()
    const aSaved = await updateArticle(db, user!.id, a, { version: 1, slug })
    await publishArticle(db, actor, aSaved, 'pt-BR', 2)
    await updateArticle(db, user!.id, await getArticle(db, a.id), { version: 2, slug: `${slug}-novo` })
    const b = await draft()
    const bSaved = await updateArticle(db, user!.id, b, { version: 1, slug })
    const revisionsBefore = await listArticleRevisions(db, bSaved)

    // The localization update breaks the published-slug index after the revision insert ran
    expect(await errorOf(publishArticle(db, actor, bSaved, 'pt-BR', 2))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'slug', message: 'published_slug_taken' }] } })
    expect(await copyOf(b.id)).toMatchObject({ status: 'draft', publishedRevisionId: null })
    expect(await listArticleRevisions(db, await getArticle(db, b.id))).toEqual(revisionsBefore)
    expect(await db.select().from(auditLog).where(and(eq(auditLog.entityId, b.id), eq(auditLog.action, 'article.published')))).toEqual([])
  })

  it('redirects the old path when the published slug changes, without chains or loops', async () => {
    const base = `caminho-${unique()}`
    const article = await draft()
    const publishAs = async (slug: string) => {
      const current = await getArticle(db, article.id)
      const version = current.localizations[0]!.version
      const saved = await updateArticle(db, user!.id, current, { version, slug })
      return publishArticle(db, actor, saved, 'pt-BR', version + 1)
    }
    expect((await publishAs(`${base}-a`)).purge).not.toContain('redirects')
    expect((await publishAs(`${base}-b`)).purge).toContain('redirects')
    await publishAs(`${base}-c`)
    const paths = async () => (await db.select({ from: redirects.fromPath, to: redirects.toPath }).from(redirects).where(eq(redirects.entityId, article.id))).map(row => `${row.from} → ${row.to}`).sort()
    expect(await paths()).toEqual([`/blog/${base}-a → /blog/${base}-c`, `/blog/${base}-b → /blog/${base}-c`])
    // Back to the first slug: its redirect goes, the others point at it
    await publishAs(`${base}-a`)
    expect(await paths()).toEqual([`/blog/${base}-b → /blog/${base}-a`, `/blog/${base}-c → /blog/${base}-a`])
  })

  it('needs alt text on informative images, in the locale or the source', async () => {
    const withoutAlt = await image(null)
    const decorative = await image(null, true)
    const withAlt = await image('Uma foto')
    const article = await draft()
    const saved = await updateArticle(db, user!.id, article, {
      version: 1,
      coverMediaId: withoutAlt,
      body: { type: 'doc', content: [
        { type: 'image', attrs: { id: 'i1', mediaId: decorative } },
        { type: 'image', attrs: { id: 'i2', mediaId: withoutAlt, altOverride: 'Texto do bloco' } },
        { type: 'gallery', attrs: { id: 'g', layout: 'grid', items: [withAlt, withoutAlt] } },
      ] },
    })
    expect(await errorOf(publishArticle(db, actor, saved, 'pt-BR', 2))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'media', message: `missing_alt:${withoutAlt}` }] } })
    await db.insert(mediaLocalizations).values({ mediaId: withoutAlt, locale: 'pt-BR', alt: 'Agora tem', translationState: 'source' })
    expect((await publishArticle(db, actor, saved, 'pt-BR', 2)).article.localizations[0]!.status).toBe('published')
  })

  it('publishes a translation only approved and after pt-BR, and unpublishing pt-BR takes it down too', async () => {
    const article = await draft()
    const de = await createLocalization(db, 'article', { articleId: article.id, locale: 'de', title: 'Titel', slug: `titel-${unique()}`, body: { type: 'doc', content: [] }, translationState: 'in_review' }, { coverMediaId: null, tagIds: [] })
    const withDe = await getArticle(db, article.id)
    expect(await errorOf(publishArticle(db, actor, withDe, 'de', 1))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'translationState', message: 'in_review' }] } })
    await db.update(articleLocalizations).set({ translationState: 'outdated' }).where(eq(articleLocalizations.id, de.id))
    expect(await errorOf(publishArticle(db, actor, await getArticle(db, article.id), 'de', 1))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'translationState', message: 'outdated' }] } })
    await db.update(articleLocalizations).set({ translationState: 'approved' }).where(eq(articleLocalizations.id, de.id))
    expect(await errorOf(publishArticle(db, actor, await getArticle(db, article.id), 'de', 1))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'source', message: 'not_published' }] } })

    await publishArticle(db, actor, await getArticle(db, article.id), 'pt-BR', 1)
    const { purge: dePurge } = await publishArticle(db, actor, await getArticle(db, article.id), 'de', 1)
    expect(dePurge).toEqual([`article:${article.id}:de`, 'list:blog:de', 'sitemap', 'rss:de'])

    const { article: down, purge } = await unpublishArticle(db, actor, await getArticle(db, article.id), 'pt-BR')
    expect(down.localizations.map(item => [item.locale, item.status, item.publishedSlug])).toEqual([['de', 'unpublished', null], ['pt-BR', 'unpublished', null]])
    expect(purge).toEqual(expect.arrayContaining([`article:${article.id}:pt-BR`, `article:${article.id}:de`, 'rss:de', 'rss:pt-BR']))
    expect(await errorOf(unpublishArticle(db, actor, down, 'pt-BR'))).toMatchObject({ statusCode: 409 })
    // Revisions stay; publishing again works
    expect((await listArticleRevisions(db, down)).filter(revision => revision.kind === 'publish')).toHaveLength(1)
    expect((await publishArticle(db, actor, down, 'pt-BR', 1)).article.localizations.find(item => item.locale === 'pt-BR')!.status).toBe('published')
  })
})

describe('schedule and the cron', () => {
  const at = new Date(Date.now() + 60 * 60 * 1000)
  const minutes = (count: number) => new Date(at.getTime() + count * 60 * 1000)

  it('schedules only ahead and from draft or unpublished, and cancels back to draft', async () => {
    const article = await draft()
    expect(await errorOf(scheduleArticle(db, article, 'pt-BR', 1, new Date(Date.now() - 1000)))).toMatchObject({ statusCode: 400 })
    expect(await errorOf(scheduleArticle(db, article, 'pt-BR', 1, new Date(Date.now() + 400 * 24 * 3600 * 1000)))).toMatchObject({ statusCode: 400 })
    const scheduled = await scheduleArticle(db, article, 'pt-BR', 1, at)
    expect(scheduled.localizations[0]).toMatchObject({ status: 'scheduled', scheduledAt: at })
    expect(await errorOf(scheduleArticle(db, scheduled, 'pt-BR', 1, at))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'status', message: 'scheduled' }] } })
    expect((await unscheduleArticle(db, scheduled, 'pt-BR')).localizations[0]).toMatchObject({ status: 'draft', scheduledAt: null })
    expect(await errorOf(unscheduleArticle(db, await getArticle(db, article.id), 'pt-BR'))).toMatchObject({ statusCode: 409 })
  })

  it('publishes within 5 minutes of the time, once, a few per run, and sends a failing one back to draft', async () => {
    const articles = [await draft(), await draft(), await draft()]
    for (const article of articles) {
      await scheduleArticle(db, article, 'pt-BR', 1, at)
    }
    // Edited after scheduling: the cron publishes the text of its run (decision 2)
    await updateArticle(db, user!.id, await getArticle(db, articles[0]!.id), { version: 1, excerpt: 'Editado depois de agendar' })

    expect((await publishDue(db, minutes(-1))).published).toBe(0)
    // The first cron tick after the time, with two per run
    const first = await publishDue(db, minutes(4), 2)
    expect(first.published).toBe(2)
    expect(first.purge).toEqual(expect.arrayContaining(['list:blog:pt-BR', 'sitemap', 'rss:pt-BR']))
    const second = await publishDue(db, minutes(9), 2)
    const third = await publishDue(db, minutes(9), 2)
    expect([second.published, third.published]).toEqual([1, 0])
    for (const article of articles) {
      const copy = await copyOf(article.id)
      expect(copy).toMatchObject({ status: 'published', scheduledAt: null })
      expect((await listArticleRevisions(db, await getArticle(db, article.id))).filter(revision => revision.kind === 'publish')).toHaveLength(1)
    }
    expect((await copyOf(articles[0]!.id)).publishedExcerpt).toBe('Editado depois de agendar')
    const audit = await db.select().from(auditLog).where(and(eq(auditLog.entityId, articles[0]!.id), eq(auditLog.action, 'article.published_on_schedule')))
    expect(audit).toHaveLength(1)
    expect(audit[0]!.actorUserId).toBeNull()

    // A scheduled article that cannot publish (an image lost its alt) goes back to draft, audited
    const cover = await image(null)
    const failing = await draft()
    await updateArticle(db, user!.id, failing, { version: 1, coverMediaId: cover })
    await db.update(articleLocalizations).set({ status: 'scheduled', scheduledAt: at }).where(eq(articleLocalizations.articleId, failing.id))
    expect(await publishDue(db, minutes(4))).toMatchObject({ published: 0, failed: 1 })
    expect(await copyOf(failing.id)).toMatchObject({ status: 'draft', scheduledAt: null })
    expect(await db.select().from(auditLog).where(and(eq(auditLog.entityId, failing.id), eq(auditLog.action, 'article.schedule_failed')))).toHaveLength(1)
  })
})
