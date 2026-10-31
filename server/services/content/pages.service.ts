// Institutional pages (F08-T2, RF-01.1, RF-01.2, RF-10.4): created on first need, the pt-BR working copy saved with
// the version read (an autosave revision each time, as articles), named versions, restore, publish and unpublish in
// guarded batches, and the public read. Translations are edited with F09; a locale without its own published page
// shows the pt-BR one with a notice and noindex (i18n-seo §3), and a page with nothing published is an empty state
import { cacheTags } from '../../../shared/cache/tags.ts'
import { contentHash } from '../../../shared/content/canonical-json.ts'
import { deriveDocument } from '../../../shared/content/derive.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import type { PublicMediaMap } from '../../../shared/media/public.ts'
import { EMPTY_PAGE_BLOCKS, pageBlockSchemas, pageDocuments } from '../../../shared/pages/blocks.ts'
import type { PageUpdate } from '../../../shared/pages/input.ts'
import type { PublicPage } from '../../../shared/pages/public.ts'
import { LOCALES, PAGE_KEYS, SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, PageKey } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { createAppError } from '../../utils/errors.ts'
import { prepareAudit } from '../audit/audit.service.ts'
import { findReadyMediaWithText } from '../media/media.repo.ts'
import { toPublicImage } from '../../../shared/media/public.ts'
import { blogPage } from './blog.service.ts'
import { resolveDocumentMedia, resolveMedia } from './document-media.ts'
import type { PageLocalizationRow } from './pages.repo.ts'
import { findPage, findPageLocalizations, insertPage, insertPageLocalization, publishPageStatements, savePageStatements, unpublishPageStatements } from './pages.repo.ts'
import { projectList } from './projects-public.service.ts'
import type { Actor } from './publishing.service.ts'
import { getRevision, prepareRevision } from './revisions.repo.ts'
import type { RevisionListItem } from './working-copy.ts'
import { assertMedia, getSourceRevision, listSourceRevisions, saveSourceVersion, sourceCopyOf, versionConflict } from './working-copy.ts'
import type { MediaUse } from './working-copy.repo.ts'

export interface PageDetail {
  id: string
  key: PageKey
  localizations: PageLocalizationRow[]
}

const conflict = (path: string, message: string) => createAppError('conflict', 'Cannot publish', [{ path, message }])

/** The page and its working copies; the page and its pt-BR copy are created the first time they are needed */
export async function getPage(db: Db, key: PageKey): Promise<PageDetail> {
  let page = await findPage(db, key)
  if (!page) {
    await insertPage(db, uuidv7(), key)
    page = (await findPage(db, key))!
  }
  let localizations = await findPageLocalizations(db, [page.id])
  if (!localizations.some(item => item.locale === SOURCE_LOCALE)) {
    const copy = { id: uuidv7(), pageId: page.id, locale: SOURCE_LOCALE, blocks: EMPTY_PAGE_BLOCKS[key] as unknown as Record<string, never>, translationState: 'source' as const }
    await insertPageLocalization(db, { ...copy, workingHash: await contentHash(snapshotOf('page', {}, copy)) })
    localizations = await findPageLocalizations(db, [page.id])
  }
  return { id: page.id, key, localizations }
}

/** Every page with its pt-BR state, for the admin list */
export async function listPages(db: Db) {
  const items = []
  for (const key of PAGE_KEYS) {
    const page = await getPage(db, key)
    items.push({
      key,
      localizations: page.localizations.map(({ locale, status, version, updatedAt, publishedAt }) => ({ locale, status, version, updatedAt, publishedAt })),
    })
  }
  return { items }
}

const documentUses = (key: PageKey, blocks: unknown): MediaUse[] =>
  pageDocuments(key, blocks).flatMap(document => deriveDocument(document, SOURCE_LOCALE).mediaUsages.map(use => ({ mediaId: use.mediaId, locale: SOURCE_LOCALE, context: use.context })))

async function writeCopy(db: Db, userId: string, page: PageDetail, current: PageLocalizationRow, version: number, fields: Partial<PageLocalizationRow>, kind: 'autosave' | 'restore'): Promise<void> {
  const next = { ...current, ...fields }
  const snapshot = snapshotOf('page', {}, next)
  const workingHash = await contentHash(snapshot)
  const uses: MediaUse[] = [...documentUses(page.key, next.blocks), ...(next.ogImageMediaId ? [{ mediaId: next.ogImageMediaId, locale: SOURCE_LOCALE, context: 'og' as const }] : [])]
  const revision = await prepareRevision('page', { localizationId: current.id, entityId: page.id, locale: SOURCE_LOCALE, kind, snapshot, createdBy: userId })
  const [updated] = await db.batch(savePageStatements(db, { pageId: page.id, localizationId: current.id, version, workingHash, localization: { ...fields, updatedBy: userId }, uses, revision }))
  if (updated.length === 0) {
    throw versionConflict('page')
  }
}

/** Saves the pt-BR working copy. 409 on "version" when it changed since the editor read it */
export async function updatePage(db: Db, userId: string, page: PageDetail, input: PageUpdate): Promise<PageDetail> {
  const current = sourceCopyOf(page.localizations)
  if (current.version !== input.version) {
    throw versionConflict('page')
  }
  const { version, ...rest } = input
  const fields = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)) as Partial<PageLocalizationRow>
  const documents = input.blocks === undefined ? [] : pageDocuments(page.key, input.blocks)
  await assertMedia(db, { images: { ogImageMediaId: input.ogImageMediaId } })
  for (const document of documents) {
    await assertMedia(db, { images: {}, body: document })
  }
  await writeCopy(db, userId, page, current, version, fields, 'autosave')
  return getPage(db, page.key)
}

export function listPageRevisions(db: Db, page: PageDetail): Promise<RevisionListItem[]> {
  return listSourceRevisions(db, 'page', sourceCopyOf(page.localizations).id)
}

export function getPageRevision(db: Db, page: PageDetail, revisionId: string) {
  return getSourceRevision(db, 'page', sourceCopyOf(page.localizations).id, revisionId)
}

export function savePageVersion(db: Db, userId: string, page: PageDetail, input: { version: number, note: string | null }) {
  return saveSourceVersion(db, 'page', {
    userId,
    entityId: page.id,
    current: sourceCopyOf(page.localizations),
    entity: {},
    version: input.version,
    note: input.note,
    reload: async () => sourceCopyOf((await getPage(db, page.key)).localizations),
  })
}

/** Copies a pt-BR revision back into the working copy and records a `restore` revision; nothing is deleted */
export async function restorePageRevision(db: Db, userId: string, page: PageDetail, input: { version: number, revisionId: string }): Promise<{ page: PageDetail, restored: number }> {
  const current = sourceCopyOf(page.localizations)
  if (current.version !== input.version) {
    throw versionConflict('page')
  }
  const revision = await getRevision(db, 'page', current.id, input.revisionId)
  if (!revision) {
    throw createAppError('not_found')
  }
  await writeCopy(db, userId, page, current, input.version, revision.snapshot.localization as Partial<PageLocalizationRow>, 'restore')
  return { page: await getPage(db, page.key), restored: revision.number }
}

/** Tags to purge: the page in every locale when pt-BR changes (the fallbacks show it), else in its own locale */
function purgeTags(key: PageKey, locale: Locale): string[] {
  return [...(locale === SOURCE_LOCALE ? LOCALES : [locale]).map(code => cacheTags.page(key, code)), cacheTags.sitemap()]
}

async function assertPublishable(db: Db, page: PageDetail, copy: PageLocalizationRow): Promise<void> {
  if (copy.locale !== SOURCE_LOCALE) {
    if (copy.translationState !== 'approved') {
      throw conflict('translationState', copy.translationState)
    }
    if (!sourceCopyOf(page.localizations).publishedRevisionId) {
      throw conflict('source', 'not_published')
    }
  }
  // Images in the page's documents need alt text (decision 3 of F06-T4)
  const ids = [...new Set(pageDocuments(page.key, copy.blocks).flatMap((document) => {
    const images: string[] = []
    for (const block of document.content) {
      if (block.type === 'image' && !block.attrs.altOverride?.trim()) {
        images.push(block.attrs.mediaId)
      }
      else if (block.type === 'gallery') {
        images.push(...block.attrs.items)
      }
    }
    return images
  }))]
  if (ids.length === 0) {
    return
  }
  const found = await findReadyMediaWithText(db, ids)
  const issues = ids.flatMap((id) => {
    const row = found.rows.find(media => media.id === id)
    if (!row || row.kind !== 'image') {
      return [{ path: 'media', message: `unavailable:${id}` }]
    }
    const image = toPublicImage(row, found.localizations.filter(media => media.mediaId === id), copy.locale)
    return image.decorative || image.alt.trim() !== '' ? [] : [{ path: 'media', message: `missing_alt:${id}` }]
  })
  if (issues.length > 0) {
    throw createAppError('conflict', 'Cannot publish', issues)
  }
}

export async function publishPage(db: Db, actor: Actor, page: PageDetail, locale: Locale, version: number): Promise<{ page: PageDetail, purge: string[] }> {
  const copy = page.localizations.find(item => item.locale === locale)
  if (!copy) {
    throw createAppError('not_found')
  }
  if (copy.version !== version) {
    throw versionConflict('page')
  }
  await assertPublishable(db, page, copy)
  const snapshot = snapshotOf('page', {}, copy)
  const revision = await prepareRevision('page', { localizationId: copy.id, entityId: page.id, locale, kind: 'publish', snapshot, createdBy: actor.userId })
  const audit = await prepareAudit({ action: 'page.published', actorUserId: actor.userId, entityType: 'page', entityId: page.key, locale, ip: actor.ip }, actor.ipHashSalt)
  const [, updated] = await db.batch(publishPageStatements(db, { localizationId: copy.id, version, from: ['draft', 'unpublished', 'published', 'scheduled'], revision, snapshot, now: new Date(), audit }))
  if (updated.length === 0) {
    throw versionConflict('page')
  }
  return { page: await getPage(db, page.key), purge: purgeTags(page.key, locale) }
}

/** Takes a localization off the site; for pt-BR, its published translations too */
export async function unpublishPage(db: Db, actor: Actor, page: PageDetail, locale: Locale): Promise<{ page: PageDetail, purge: string[] }> {
  const copy = page.localizations.find(item => item.locale === locale)
  if (!copy?.publishedRevisionId) {
    throw conflict('status', copy?.status ?? 'draft')
  }
  const targets = locale === SOURCE_LOCALE ? page.localizations.filter(item => item.publishedRevisionId) : [copy]
  const audit = await prepareAudit({ action: 'page.unpublished', actorUserId: actor.userId, entityType: 'page', entityId: page.key, locale, metadata: { locales: targets.map(item => item.locale).join(',') }, ip: actor.ip }, actor.ipHashSalt)
  await db.batch(unpublishPageStatements(db, targets.map(item => item.id), audit))
  return { page: await getPage(db, page.key), purge: purgeTags(page.key, locale) }
}

// Public read

export async function publicPage(db: Db, key: PageKey, locale: Locale): Promise<PublicPage> {
  const page = await findPage(db, key)
  const localizations = page ? await findPageLocalizations(db, [page.id]) : []
  const published = localizations.filter(item => item.publishedRevisionId && item.publishedSnapshot)
  const chosen = published.find(item => item.locale === locale) ?? published.find(item => item.locale === SOURCE_LOCALE)
  const parsed = chosen ? pageBlockSchemas[key].safeParse(chosen.publishedSnapshot!.localization.blocks) : undefined
  const blocks = parsed?.success ? parsed.data : null
  const ogImageMediaId = chosen?.publishedSnapshot?.localization.ogImageMediaId ?? null
  const documents = blocks ? pageDocuments(key, blocks) : []
  const mediaParts = await Promise.all([
    ...documents.map(document => resolveDocumentMedia(db, document, locale)),
    resolveMedia(db, ogImageMediaId ? [ogImageMediaId] : [], locale),
  ])
  const media = Object.assign({}, ...mediaParts) as PublicMediaMap
  const tags = [cacheTags.page(key, locale), ...Object.keys(media).map(cacheTags.media)]

  let home: PublicPage['home']
  if (key === 'home') {
    const [projects, articles] = await Promise.all([projectList(db, locale), blogPage(db, locale, 1)])
    home = { projects: (projects?.items ?? []).filter(item => item.featured), articles: (articles?.items ?? []).slice(0, 3) }
    tags.push(cacheTags.projectList(locale), cacheTags.blogList(locale), ...(projects?.cacheTags ?? []), ...(articles?.cacheTags ?? []))
  }
  return {
    key,
    fallback: !!blocks && chosen!.locale !== locale,
    empty: !blocks,
    blocks,
    published: published.map(item => item.locale),
    seo: {
      title: chosen?.publishedSnapshot?.localization.seoTitle ?? null,
      description: chosen?.publishedSnapshot?.localization.seoDescription ?? null,
      noindex: chosen?.publishedSnapshot?.localization.noindex ?? false,
    },
    media,
    ...(home ? { home } : {}),
    cacheTags: [...new Set(tags)],
  }
}
