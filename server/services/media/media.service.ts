// Media library rules (ADR-0007 §3, §8): manifest → uploads → finalize, metadata per locale and soft delete.
// Only the admin who created a pending item may upload to it or finalize it; R2 keys come from shared/media/keys.ts
import { expectedUploads, imageVariantName } from '../../../shared/media/keys.ts'
import type { ExpectedUpload } from '../../../shared/media/keys.ts'
import type { MediaManifest } from '../../../shared/media/schemas.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { createAppError } from '../../utils/errors.ts'
import {
  findMedia,
  findMediaIdBySha256,
  findReadyImage,
  insertMedia,
  listLocalizations,
  listMedia,
  listTracks,
  listUsages,
  markReady,
  softDeleteMedia,
  updateMedia,
} from './media.repo.ts'
import type { MediaFilters, MediaRow } from './media.repo.ts'
import { streamUploadToR2 } from './upload.ts'

type Tracks = Awaited<ReturnType<typeof listTracks>>

function uploadsOf(row: MediaRow, tracks: Tracks): ExpectedUpload[] {
  return expectedUploads({
    kind: row.kind,
    sha256: row.sha256,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    variants: row.variants,
    tracks,
  })
}

const publicUpload = ({ name, contentType, size }: ExpectedUpload) => ({ name, contentType, size })

/** Registers a pending item and returns the uploads it expects; the same file (by hash) is never stored twice */
export async function createMedia(db: Db, userId: string, manifest: MediaManifest) {
  const existing = await findMediaIdBySha256(db, manifest.sha256)
  if (existing) {
    throw createAppError('conflict', 'Media already uploaded', [{ path: 'sha256', message: `Already uploaded as media ${existing}` }])
  }
  if (manifest.kind === 'video' && !await findReadyImage(db, manifest.posterMediaId)) {
    throw createAppError('bad_request', 'Invalid input', [{ path: 'posterMediaId', message: 'Must be a ready image' }])
  }

  const variants = manifest.kind === 'image' ? manifest.variants : []
  const tracks = manifest.kind === 'video' ? manifest.tracks : []
  const plan = expectedUploads({ kind: manifest.kind, sha256: manifest.sha256, mimeType: manifest.mimeType, sizeBytes: manifest.size, variants, tracks })
  const keyOf = (name: string) => plan.find(upload => upload.name === name)!.key

  const id = uuidv7()
  await insertMedia(db, {
    id,
    kind: manifest.kind,
    mimeType: manifest.mimeType,
    originalFilename: manifest.originalFilename,
    sizeBytes: manifest.size,
    width: manifest.width,
    height: manifest.height,
    durationMs: manifest.kind === 'video' ? manifest.durationMs : null,
    sha256: manifest.sha256,
    originalKey: keyOf('original'),
    variants: variants.map(variant => ({ ...variant, name: imageVariantName(variant.format, variant.width), key: keyOf(imageVariantName(variant.format, variant.width)) })),
    placeholderDataUrl: manifest.kind === 'image' ? manifest.placeholderDataUrl : null,
    dominantColor: manifest.kind === 'image' ? manifest.dominantColor : null,
    posterMediaId: manifest.kind === 'video' ? manifest.posterMediaId : null,
    createdBy: userId,
    updatedBy: userId,
  }, tracks.map(track => ({ locale: track.locale, kind: track.kind, label: track.label, size: track.size, key: keyOf(`${track.kind}-${track.locale}`) })))

  return { id, status: 'pending' as const, uploads: plan.map(publicUpload) }
}

async function pendingOwnedBy(db: Db, userId: string, id: string): Promise<MediaRow> {
  const row = await findMedia(db, id)
  if (!row) {
    throw createAppError('not_found')
  }
  if (row.createdBy !== userId) {
    throw createAppError('forbidden', 'Only the uploader may send files for this media')
  }
  if (row.status !== 'pending') {
    throw createAppError('conflict', 'Media already finalized')
  }
  return row
}

export interface UploadRequest {
  name: string
  contentType: string | undefined
  contentLength: string | undefined
  body: ReadableStream<Uint8Array> | undefined
}

/** One file of the manifest, streamed to its server-chosen key; UploadRejectedError when the bytes do not match */
export async function uploadMediaFile(db: Db, bucket: R2Bucket, userId: string, id: string, request: UploadRequest) {
  const row = await pendingOwnedBy(db, userId, id)
  const upload = uploadsOf(row, await listTracks(db, id)).find(item => item.name === request.name)
  if (!upload) {
    throw createAppError('bad_request', 'Not an upload of this media')
  }
  if (request.contentType?.split(';')[0]?.trim().toLowerCase() !== upload.contentType) {
    throw createAppError('unsupported_media_type', `Expected ${upload.contentType}`)
  }
  if (!request.contentLength || !/^\d+$/.test(request.contentLength) || Number(request.contentLength) !== upload.size || !request.body) {
    throw createAppError('bad_request', `Content-Length must be the declared size (${upload.size})`)
  }
  await streamUploadToR2(bucket, upload.key, request.body, upload.size, upload.contentType)
  return { name: upload.name, contentType: upload.contentType, size: upload.size }
}

/** Ready only when every expected object is in R2 with its declared size */
export async function finalizeMedia(db: Db, bucket: R2Bucket, userId: string, id: string) {
  const row = await pendingOwnedBy(db, userId, id)
  const uploads = uploadsOf(row, await listTracks(db, id))
  const objects = await Promise.all(uploads.map(upload => bucket.head(upload.key)))
  const missing = uploads.filter((upload, index) => objects[index]?.size !== upload.size)
  if (missing.length > 0) {
    throw createAppError('conflict', 'Uploads missing', missing.map(upload => ({ path: upload.name, message: 'Not uploaded' })))
  }
  if (!await markReady(db, id, row.posterMediaId ? { mediaId: row.posterMediaId } : undefined)) {
    throw createAppError('conflict', 'Media already finalized')
  }
  return { id, status: 'ready' as const, uploads: uploads.length, bytes: uploads.reduce((sum, upload) => sum + upload.size, 0) }
}

export async function getMediaDetail(db: Db, id: string) {
  const row = await findMedia(db, id)
  if (!row) {
    throw createAppError('not_found')
  }
  const [localizations, tracks, usages] = await Promise.all([listLocalizations(db, id), listTracks(db, id), listUsages(db, id)])
  // The original's key stays internal: originals are never served
  const { originalKey: _originalKey, ...media } = row
  return {
    ...media,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    localizations,
    tracks: tracks.map(({ locale, kind, label, key }) => ({ locale, kind, label, key })),
    usages,
  }
}

export interface MetadataInput {
  focalX?: number | undefined
  focalY?: number | undefined
  decorative?: boolean | undefined
  localizations?: Partial<Record<Locale, { alt?: string | undefined, caption?: string | null | undefined, credit?: string | null | undefined }>> | undefined
}

/** Focal point, decorative flag and alt/caption/credit per locale; a person typing them makes them approved */
export async function updateMediaMetadata(db: Db, userId: string, id: string, input: MetadataInput) {
  if (!await findMedia(db, id)) {
    throw createAppError('not_found')
  }
  const localizations = Object.entries(input.localizations ?? {}).map(([locale, fields]) => ({
    locale: locale as Locale,
    ...fields,
    translationState: locale === SOURCE_LOCALE ? 'source' as const : 'approved' as const,
  }))
  await updateMedia(db, id, userId, { focalX: input.focalX, focalY: input.focalY, decorative: input.decorative }, localizations)
  return getMediaDetail(db, id)
}

/** The row for an ownership check before deleting */
export async function findMediaForDelete(db: Db, id: string): Promise<MediaRow> {
  const row = await findMedia(db, id)
  if (!row) {
    throw createAppError('not_found')
  }
  return row
}

/** Soft delete, refused with the list of uses while anything still uses the media */
export async function deleteMedia(db: Db, userId: string, id: string) {
  const usages = await listUsages(db, id)
  if (usages.length > 0) {
    throw createAppError('conflict', 'Media in use', usages.map(usage => ({
      path: [usage.entityType, usage.entityId, usage.locale ?? '*', usage.context].join(':'),
      message: 'In use',
    })))
  }
  if (!await softDeleteMedia(db, id, userId)) {
    throw createAppError('not_found')
  }
}

export interface MediaQuery extends Omit<MediaFilters, 'before'> {
  cursor?: string | undefined
  limit: number
}

export async function queryMedia(db: Db, query: MediaQuery) {
  const rows = await listMedia(db, { ...query, before: query.cursor }, query.limit + 1)
  const page = rows.slice(0, query.limit)
  return {
    items: page.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })),
    nextCursor: rows.length > query.limit ? page.at(-1)?.id ?? null : null,
  }
}
