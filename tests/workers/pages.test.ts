// F08-T2: institutional pages on a real D1. A page is created on first need, empty; saves go through the version read
// with an autosave revision; the public reads only what is published: the locale's page, else pt-BR (fallback), else
// an empty state; publishing pt-BR purges the page in every locale; versions and restore keep the history
import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { users } from '../../server/db/schema'
import { createLocalization } from '../../server/services/content/localized.repo'
import {
  getPage,
  listPageRevisions,
  publicPage,
  publishPage,
  restorePageRevision,
  savePageVersion,
  unpublishPage,
  updatePage,
} from '../../server/services/content/pages.service'
import { EMPTY_PAGE_BLOCKS, pageBlockSchemas } from '../../shared/pages/blocks'
import { pageUpdateSchema } from '../../shared/pages/input'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Páginas', email: `pages-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const actor = { userId, ip: null, ipHashSalt: undefined }
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))
const ptBR = (page: Awaited<ReturnType<typeof getPage>>) => page.localizations.find(item => item.locale === 'pt-BR')!

describe('institutional pages', () => {
  it('starts empty on first need, once, and the public shows an empty state', async () => {
    const first = await getPage(db, 'contact')
    const again = await getPage(db, 'contact')
    expect(again.id).toBe(first.id)
    expect(ptBR(first)).toMatchObject({ status: 'draft', version: 1, translationState: 'source', blocks: EMPTY_PAGE_BLOCKS.contact })
    const read = await publicPage(db, 'contact', 'pt-BR')
    expect(read).toMatchObject({ empty: true, fallback: false, blocks: null, published: [] })
    expect(read.cacheTags).toContain('page:contact:pt-BR')
  })

  it('validates the blocks by page and saves with the version read', async () => {
    expect(pageBlockSchemas.home.safeParse(EMPTY_PAGE_BLOCKS.home).success).toBe(true)
    const schema = pageUpdateSchema('about')
    expect(schema.safeParse({ version: 1, blocks: { ...EMPTY_PAGE_BLOCKS.about, links: [{ label: 'x', url: 'http://x.com' }] } }).success).toBe(false)
    expect(schema.safeParse({ version: 1, blocks: { ...EMPTY_PAGE_BLOCKS.about, extra: 1 } }).success).toBe(false)
    expect(pageUpdateSchema('home').safeParse({ version: 1, blocks: { ...EMPTY_PAGE_BLOCKS.home, hero: { ...EMPTY_PAGE_BLOCKS.home.hero, cta: { label: 'Ir', target: 'admin' } } } }).success).toBe(false)

    const page = await getPage(db, 'blog')
    const version = ptBR(page).version
    const saved = await updatePage(db, userId, page, { version, blocks: { title: 'Escritos', intro: 'Notas' }, seoTitle: 'Blog SEO' })
    expect(ptBR(saved)).toMatchObject({ version: version + 1, blocks: { title: 'Escritos', intro: 'Notas' }, seoTitle: 'Blog SEO' })
    expect(await errorOf(updatePage(db, userId, saved, { version, blocks: { title: 'Velho', intro: '' } }))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'version' }] } })
    expect((await listPageRevisions(db, saved))[0]).toMatchObject({ kind: 'autosave' })
  })

  it('publishes pt-BR: the other locales fall back to it, and only what is published is public', async () => {
    const page = await getPage(db, 'projects')
    const saved = await updatePage(db, userId, page, { version: ptBR(page).version, blocks: { title: 'Trabalhos', intro: 'Publicado' } })
    const { page: published, purge } = await publishPage(db, actor, saved, 'pt-BR', ptBR(saved).version)
    expect(ptBR(published).status).toBe('published')
    expect(purge).toEqual(['page:projects:pt-BR', 'page:projects:en', 'page:projects:es', 'page:projects:de', 'page:projects:fr', 'sitemap'])

    // A saved change after publishing stays off the site
    await updatePage(db, userId, published, { version: ptBR(published).version, blocks: { title: 'Rascunho', intro: '' } })
    expect(await publicPage(db, 'projects', 'pt-BR')).toMatchObject({ empty: false, fallback: false, blocks: { title: 'Trabalhos' }, published: ['pt-BR'] })
    expect(await publicPage(db, 'projects', 'de')).toMatchObject({ fallback: true, blocks: { title: 'Trabalhos' }, published: ['pt-BR'] })

    // An approved German page: no fallback there any more
    await createLocalization(db, 'page', { pageId: page.id, locale: 'de', blocks: { title: 'Arbeiten', intro: 'Deutsch' } as never, translationState: 'approved' }, {})
    const withGerman = await getPage(db, 'projects')
    const german = withGerman.localizations.find(item => item.locale === 'de')!
    const result = await publishPage(db, actor, withGerman, 'de', german.version)
    expect(result.purge).toEqual(['page:projects:de', 'sitemap'])
    expect(await publicPage(db, 'projects', 'de')).toMatchObject({ fallback: false, blocks: { title: 'Arbeiten' }, published: ['de', 'pt-BR'] })

    // pt-BR off the site takes its translations with it
    await unpublishPage(db, actor, await getPage(db, 'projects'), 'pt-BR')
    expect(await publicPage(db, 'projects', 'de')).toMatchObject({ empty: true, published: [] })
  })

  it('names versions and restores one without deleting any', async () => {
    const page = await getPage(db, 'privacy')
    const first = await updatePage(db, userId, page, { version: ptBR(page).version, blocks: { body: null, updatedOn: '2026-10-01' } })
    const { revision } = await savePageVersion(db, userId, first, { version: ptBR(first).version, note: 'Primeira' })
    const second = await updatePage(db, userId, first, { version: ptBR(first).version, blocks: { body: null, updatedOn: '2026-10-30' } })
    const { page: restored, restored: number } = await restorePageRevision(db, userId, second, { version: ptBR(second).version, revisionId: revision.id })
    expect(number).toBe(revision.number)
    expect(ptBR(restored).blocks).toMatchObject({ updatedOn: '2026-10-01' })
    expect((await listPageRevisions(db, restored)).map(item => item.kind)).toEqual(expect.arrayContaining(['restore', 'manual', 'autosave']))
  })
})
