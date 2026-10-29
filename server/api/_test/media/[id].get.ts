// Test-only (PORTFOLIO_TEST_BUILD=1): one ready media item in the public shape, for the media test page and its
// Lighthouse run. Content (F05+) delivers the same shape through its own published snapshots
import { z } from 'zod'
import { toPublicImage } from '#shared/media/public'
import type { PublicVideo } from '#shared/media/public'
import { LOCALES } from '#shared/types/enums'
import { findMedia, listLocalizations, listTracks } from '../../../services/media/media.repo.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })
const querySchema = z.object({ locale: z.enum(LOCALES).default('pt-BR') })

export default defineEventHandler(async (event) => {
  const { id } = getValidatedParamsStrict(event, paramsSchema)
  const { locale } = getValidatedQueryStrict(event, querySchema)
  const db = useDb(event)
  const row = await findMedia(db, id)
  if (!row || row.status !== 'ready') {
    throw createAppError('not_found')
  }
  if (row.kind === 'image') {
    return { kind: 'image' as const, image: toPublicImage(row, await listLocalizations(db, id), locale) }
  }
  const poster = row.posterMediaId ? await findMedia(db, row.posterMediaId) : undefined
  const video: PublicVideo = {
    width: row.width ?? 0,
    height: row.height ?? 0,
    key: row.originalKey,
    mimeType: row.mimeType,
    durationMs: row.durationMs,
    poster: poster ? toPublicImage(poster, await listLocalizations(db, poster.id), locale) : null,
    tracks: (await listTracks(db, id)).map(({ locale: trackLocale, kind, label, key }) => ({ locale: trackLocale, kind, label, key })),
  }
  return { kind: 'video' as const, video }
})
