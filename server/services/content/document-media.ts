// Media a document points at, in the public shape (ADR-0007 §5–§6), for the renderer: one D1 batch for the
// document's items and one more for video posters. Items that are missing, pending or deleted are left out, and
// the renderer skips their blocks
import type { DocumentJson } from '../../../shared/content/document-schema.ts'
import { deriveDocument } from '../../../shared/content/derive.ts'
import { toPublicImage } from '../../../shared/media/public.ts'
import type { PublicMediaMap } from '../../../shared/media/public.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { findReadyMediaWithText } from '../media/media.repo.ts'

export async function resolveDocumentMedia(db: Db, doc: DocumentJson, locale: Locale, extraIds: readonly string[] = []): Promise<PublicMediaMap> {
  return resolveMedia(db, [...new Set([...deriveDocument(doc, locale).mediaUsages.map(use => use.mediaId), ...extraIds])], locale)
}

/** Media by id, in the public shape; ready items only */
export async function resolveMedia(db: Db, ids: readonly string[], locale: Locale): Promise<PublicMediaMap> {
  const found = await findReadyMediaWithText(db, ids)
  const posterIds = found.rows.flatMap(row => (row.kind === 'video' && row.posterMediaId && !ids.includes(row.posterMediaId) ? [row.posterMediaId] : []))
  const posters = await findReadyMediaWithText(db, posterIds)
  const rows = new Map([...found.rows, ...posters.rows].map(row => [row.id, row]))
  const localizations = [...found.localizations, ...posters.localizations]
  const textOf = (id: string) => localizations.filter(item => item.mediaId === id)
  const image = (id: string) => {
    const row = rows.get(id)
    return row?.kind === 'image' ? toPublicImage(row, textOf(id), locale) : null
  }

  const map: PublicMediaMap = {}
  for (const id of ids) {
    const row = rows.get(id)
    if (row?.kind === 'image') {
      map[id] = { kind: 'image', image: image(id)! }
    }
    else if (row?.kind === 'video') {
      map[id] = {
        kind: 'video',
        video: {
          width: row.width ?? 0,
          height: row.height ?? 0,
          key: row.originalKey,
          mimeType: row.mimeType,
          durationMs: row.durationMs,
          poster: row.posterMediaId ? image(row.posterMediaId) : null,
          tracks: found.tracks.filter(track => track.mediaId === id).map(({ locale: trackLocale, kind, label, key }) => ({ locale: trackLocale, kind, label, key })),
        },
      }
    }
  }
  return map
}
