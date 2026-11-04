// The share image of a localization (F11-T2). The admin draws it in the browser (ADR-0007: nothing is rendered on
// the server) and uploads it as media; here it reads what the drawing needs (the title, the site's name and the
// current image, to tell a generated one from one chosen by hand) and sets the localization's og_image_media_id
// alone, guarded by the version like a save. The next publish carries it in the snapshot
import { contentHash } from '../../../shared/content/canonical-json.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import type { SluggedContentType } from '../../../shared/content/snapshot.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { createAppError } from '../../utils/errors.ts'
import { findMedia } from '../media/media.repo.ts'
import { siteName } from '../settings/settings.service.ts'
import type { ArticleDetail } from './articles.service.ts'
import { articleEntity } from './articles.service.ts'
import type { ProjectDetail } from './projects.service.ts'
import { projectEntity } from './projects.service.ts'
import { assertMedia, versionConflict } from './working-copy.ts'
import { shareImageStatements } from './working-copy.repo.ts'

type Item = { type: 'article', item: ArticleDetail } | { type: 'project', item: ProjectDetail }

export interface ShareImageState {
  locale: Locale
  title: string
  version: number
  siteName: string
  /** The image the localization has now, with its file name: a generated one is named after the item and locale */
  current: { mediaId: string, filename: string } | null
}

function copyOf(target: Item, locale: Locale) {
  const copy = (target.item.localizations as { locale: Locale }[]).find(row => row.locale === locale)
  if (!copy) {
    throw createAppError('not_found')
  }
  return copy as Item['item']['localizations'][number]
}

export async function shareImageState(db: Db, target: Item, locale: Locale): Promise<ShareImageState> {
  const copy = copyOf(target, locale)
  const [name, current] = await Promise.all([siteName(db), copy.ogImageMediaId ? findMedia(db, copy.ogImageMediaId) : undefined])
  return {
    locale,
    title: copy.title,
    version: copy.version,
    siteName: name,
    current: current ? { mediaId: current.id, filename: current.originalFilename } : null,
  }
}

/** Sets the share image of one localization; 400 when it is not a ready image, 409 when the copy changed */
export async function setShareImage(db: Db, userId: string, target: Item, locale: Locale, input: { version: number, mediaId: string }): Promise<void> {
  const copy = copyOf(target, locale)
  if (copy.version !== input.version) {
    throw versionConflict(target.type)
  }
  await assertMedia(db, { images: { mediaId: input.mediaId } })
  const entity = target.type === 'article' ? articleEntity(target.item) : projectEntity(target.item)
  const workingHash = await contentHash(snapshotOf(target.type as SluggedContentType, entity as never, { ...copy, ogImageMediaId: input.mediaId }))
  const [updated] = await db.batch(shareImageStatements(db, target.type, {
    entityId: target.item.id,
    localizationId: copy.id,
    locale,
    version: input.version,
    workingHash,
    mediaId: input.mediaId,
    userId,
  }))
  if (updated.length === 0) {
    throw versionConflict(target.type)
  }
}
