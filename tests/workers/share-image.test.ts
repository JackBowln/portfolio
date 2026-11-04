// F11-T2: the generated share image on a real D1. Its state names the current file; setting it changes only that
// field on top of the version (409 when stale, 400 for a media that is not a ready image) and records its `og` use per
// locale, which a pt-BR save keeps; the next publish carries it, and the public article gets it as og:image with the
// title as alt, tagged for purges
import { env } from 'cloudflare:test'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { mediaUsages, users } from '../../server/db/schema'
import type { media } from '../../server/db/schema'
import { createArticle, getArticle, updateArticle } from '../../server/services/content/articles.service'
import { blogArticle } from '../../server/services/content/blog.service'
import { createLocalization } from '../../server/services/content/localized.repo'
import { createProject, getProject, publishProject } from '../../server/services/content/projects.service'
import { publicProject } from '../../server/services/content/projects-public.service'
import { publishArticle } from '../../server/services/content/publishing.service'
import { setShareImage, shareImageState } from '../../server/services/content/share-image.service'
import { insertMedia, markReady } from '../../server/services/media/media.repo'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Imagens', email: `share-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const actor = { userId, ip: null, ipHashSalt: undefined }
const unique = () => uuidv7().slice(-8)
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))

/** A ready 1200 × 630 image with the variants the pipeline makes for a share image */
async function shareMedia(filename: string, ready = true) {
  const hash = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')
  const variants = [320, 640, 960, 1200].flatMap(width => (['avif', 'webp', 'jpeg'] as const).map(format => ({
    name: `${format}-${width}`,
    format,
    width,
    height: Math.round(width * 630 / 1200),
    key: `media/${hash.slice(0, 2)}/${hash}/${format}-${width}.${format === 'jpeg' ? 'jpg' : format}`,
    size: 1000,
  })))
  const row: typeof media.$inferInsert = { id: uuidv7(), kind: 'image', mimeType: 'image/jpeg', originalFilename: filename, sizeBytes: 1000, width: 1200, height: 630, sha256: hash, originalKey: `originals/${hash}.jpg`, variants, decorative: true }
  await insertMedia(db, row, [])
  if (ready) {
    await markReady(db, row.id!)
  }
  return { id: row.id!, hash }
}

async function publishedArticle() {
  const draft = await createArticle(db, userId, `Compartilhar ${unique()}`)
  const saved = await updateArticle(db, userId, draft, { version: 1, excerpt: 'Resumo' })
  return (await publishArticle(db, actor, saved, 'pt-BR', 2)).article
}

const usesOf = (entityId: string) => db.select().from(mediaUsages).where(and(eq(mediaUsages.entityId, entityId), eq(mediaUsages.context, 'og')))

describe('share image of a localization', () => {
  it('sets only the image on top of the version, and the next publish puts it on the public article', async () => {
    const article = await publishedArticle()
    const source = article.localizations[0]!
    expect(await shareImageState(db, { type: 'article', item: article }, 'pt-BR')).toMatchObject({ locale: 'pt-BR', title: source.title, version: source.version, current: null })

    const image = await shareMedia(`og-article-${article.id}-pt-BR-0123456789abcdef.jpg`)
    await setShareImage(db, userId, { type: 'article', item: article }, 'pt-BR', { version: source.version, mediaId: image.id })
    const after = await getArticle(db, article.id)
    const copy = after.localizations[0]!
    expect(copy).toMatchObject({ ogImageMediaId: image.id, version: source.version + 1, title: source.title, body: source.body })
    expect(copy.workingHash).not.toBe(source.workingHash)
    expect((await shareImageState(db, { type: 'article', item: after }, 'pt-BR')).current).toEqual({ mediaId: image.id, filename: `og-article-${article.id}-pt-BR-0123456789abcdef.jpg` })
    expect((await usesOf(article.id)).map(use => [use.mediaId, use.locale])).toEqual([[image.id, 'pt-BR']])

    // Not on the site before the publish: the site reads the published snapshot
    expect((await blogArticle(db, 'pt-BR', copy.slug, 'https://media.example.test'))?.seo.image).toBeNull()
    await publishArticle(db, actor, after, 'pt-BR', copy.version)
    const read = await blogArticle(db, 'pt-BR', copy.slug, 'https://media.example.test')
    expect(read?.seo.image).toEqual({ url: `https://media.example.test/media/${image.hash.slice(0, 2)}/${image.hash}/jpeg-1200.jpg`, width: 1200, height: 630, alt: source.title })
    expect(read?.cacheTags).toContain(`media:${image.id}`)
  })

  it('refuses a stale version and a media that is not a ready image', async () => {
    const article = await publishedArticle()
    const source = article.localizations[0]!
    const image = await shareMedia(`og-article-${article.id}-pt-BR-aaaaaaaaaaaaaaaa.jpg`)
    expect(await errorOf(setShareImage(db, userId, { type: 'article', item: article }, 'pt-BR', { version: source.version + 3, mediaId: image.id }))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'version', message: 'stale' }] } })
    const pending = await shareMedia('og-pendente.jpg', false)
    expect(await errorOf(setShareImage(db, userId, { type: 'article', item: article }, 'pt-BR', { version: source.version, mediaId: pending.id }))).toMatchObject({ statusCode: 400, data: { issues: [{ path: 'mediaId', message: 'must be a ready image' }] } })
    expect(await errorOf(shareImageState(db, { type: 'article', item: article }, 'fr'))).toMatchObject({ statusCode: 404 })
    expect((await getArticle(db, article.id)).localizations[0]!.version).toBe(source.version)
  })

  it('keeps a translation\'s image use when pt-BR is saved', async () => {
    const article = await publishedArticle()
    await createLocalization(db, 'article', { articleId: article.id, locale: 'de', title: 'Teilen', slug: `teilen-${unique()}`, body: { type: 'doc', content: [] }, translationState: 'approved' }, { coverMediaId: null, tagIds: [] })
    const withDe = await getArticle(db, article.id)
    const image = await shareMedia(`og-article-${article.id}-de-bbbbbbbbbbbbbbbb.jpg`)
    await setShareImage(db, userId, { type: 'article', item: withDe }, 'de', { version: 1, mediaId: image.id })
    // The translation publishes with it
    const de = (await getArticle(db, article.id)).localizations.find(copy => copy.locale === 'de')!
    await publishArticle(db, actor, await getArticle(db, article.id), 'de', de.version)
    expect((await blogArticle(db, 'de', de.slug, 'https://m.test'))?.seo.image).toMatchObject({ width: 1200, alt: 'Teilen' })

    const source = withDe.localizations.find(copy => copy.locale === 'pt-BR')!
    await updateArticle(db, userId, await getArticle(db, article.id), { version: source.version, excerpt: 'Outro resumo' })
    expect((await usesOf(article.id)).map(use => [use.mediaId, use.locale])).toEqual([[image.id, 'de']])
  })

  it('serves projects the same way', async () => {
    const project = await createProject(db, userId, `Projeto ${unique()}`)
    const source = project.localizations[0]!
    const image = await shareMedia(`og-project-${project.id}-pt-BR-cccccccccccccccc.jpg`)
    await setShareImage(db, userId, { type: 'project', item: project }, 'pt-BR', { version: source.version, mediaId: image.id })
    const after = await getProject(db, project.id)
    await publishProject(db, actor, after, 'pt-BR', after.localizations[0]!.version)
    expect((await publicProject(db, 'pt-BR', source.slug, 'https://m.test'))?.seo.image).toMatchObject({ width: 1200, height: 630, alt: source.title })
  })
})
