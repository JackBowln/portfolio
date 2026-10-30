// F04-T1: the media repository on a real D1 (migration 0003): uniqueness of the content hash, soft delete hidden
// from reads, the filters of the library and the uses that block deletion (data-model §5)
import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { mediaLocalizations, users } from '../../server/db/schema'
import type { media } from '../../server/db/schema'
import {
  findMedia,
  findMediaIdBySha256,
  insertMedia,
  insertUsage,
  listMedia,
  listTracks,
  listUsages,
  markReady,
  softDeleteMedia,
  updateMedia,
} from '../../server/services/media/media.repo'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Media tester', email: `media-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const sha = () => [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')

function row(overrides: Partial<typeof media.$inferInsert> = {}) {
  const hash = sha()
  return {
    id: uuidv7(),
    kind: 'image' as const,
    mimeType: 'image/jpeg' as const,
    originalFilename: 'foto.jpg',
    sizeBytes: 100,
    width: 1000,
    height: 750,
    sha256: hash,
    originalKey: `originals/${hash}.jpg`,
    variants: [],
    ...overrides,
  }
}

describe('media repository', () => {
  it('stores the row and its tracks in one batch, pending by default', async () => {
    const video = row({ kind: 'video', mimeType: 'video/mp4' })
    const inserted = await insertMedia(db, video, [{ locale: 'de', kind: 'captions', label: 'Deutsch', key: 'k', size: 10 }])

    expect(inserted.status).toBe('pending')
    expect(inserted.focalX).toBe(0.5)
    expect(await listTracks(db, video.id)).toEqual([{ locale: 'de', kind: 'captions', label: 'Deutsch', key: 'k', size: 10 }])
  })

  it('keeps the content hash unique, deleted rows included', async () => {
    const first = row()
    await insertMedia(db, first, [])
    await softDeleteMedia(db, first.id, userId)

    expect(await findMediaIdBySha256(db, first.sha256)).toBe(first.id)
    await expect(insertMedia(db, row({ sha256: first.sha256 }), [])).rejects.toThrow()
  })

  it('rejects a focal point outside 0–1', async () => {
    await expect(insertMedia(db, row({ focalX: 1.5 }), [])).rejects.toThrow()
  })

  it('hides soft-deleted media from reads and deletes only once', async () => {
    const item = row()
    await insertMedia(db, item, [])

    expect(await softDeleteMedia(db, item.id, userId)).toBe(true)
    expect(await softDeleteMedia(db, item.id, userId)).toBe(false)
    expect(await findMedia(db, item.id)).toBeUndefined()
    expect((await listMedia(db, {}, 100)).map(entry => entry.id)).not.toContain(item.id)
  })

  it('finalizes once, and a video finalize records its poster use', async () => {
    const poster = row()
    const video = row({ kind: 'video', mimeType: 'video/mp4', posterMediaId: poster.id })
    await insertMedia(db, poster, [])
    await insertMedia(db, video, [])

    expect(await markReady(db, video.id, { mediaId: poster.id })).toBe(true)
    expect(await markReady(db, video.id)).toBe(false)
    expect(await listUsages(db, poster.id)).toEqual([{ entityType: 'media', entityId: video.id, locale: null, context: 'poster' }])
  })

  it('filters by missing pt-BR alt, skipping decorative images, and searches names literally', async () => {
    const tag = sha().slice(0, 8)
    const withAlt = row({ originalFilename: `${tag}-a.jpg` })
    const withoutAlt = row({ originalFilename: `${tag}-b.jpg` })
    const decorative = row({ originalFilename: `${tag}-c.jpg`, decorative: true })
    const percent = row({ originalFilename: `${tag}-100%.jpg` })
    for (const item of [withAlt, withoutAlt, decorative, percent]) {
      await insertMedia(db, item, [])
    }
    await updateMedia(db, withAlt.id, userId, {}, [{ locale: 'pt-BR', alt: 'Uma foto', translationState: 'source' }])
    await updateMedia(db, withoutAlt.id, userId, {}, [{ locale: 'de', alt: 'Ein Foto', translationState: 'approved' }])

    const missing = (await listMedia(db, { search: tag, missingAlt: true }, 100)).map(entry => entry.id)
    expect(missing).toContain(withoutAlt.id)
    expect(missing).not.toContain(withAlt.id)
    expect(missing).not.toContain(decorative.id)
    expect((await listMedia(db, { search: `${tag}-100%` }, 100)).map(entry => entry.id)).toEqual([percent.id])
    // As wildcards, `%` and `_` would match the other names too
    expect(await listMedia(db, { search: `${tag}-1%` }, 100)).toEqual([])
    expect(await listMedia(db, { search: `${tag}_` }, 100)).toEqual([])
  })

  // D1 refuses LIKE patterns over 50 bytes; the admin accepts searches of up to 100 characters
  it('searches with a long term, ignoring ASCII case', async () => {
    const name = `${sha().slice(0, 8)}-${'fotografia-da-praia-ao-entardecer-'.repeat(2)}final.jpg`
    const item = row({ originalFilename: name })
    await insertMedia(db, item, [])
    const term = name.slice(0, 90).toUpperCase()
    expect(term.length).toBeGreaterThan(50)
    expect((await listMedia(db, { search: term }, 100)).map(entry => entry.id)).toEqual([item.id])
  })

  it('upserts localizations and cascades them with the row', async () => {
    const item = row()
    await insertMedia(db, item, [])
    await updateMedia(db, item.id, userId, { focalX: 0.2 }, [{ locale: 'fr', alt: 'Une', translationState: 'approved' }])
    await updateMedia(db, item.id, userId, {}, [{ locale: 'fr', caption: 'Légende', translationState: 'approved' }])

    const rows = await env.DB.prepare('SELECT alt, caption FROM media_localizations WHERE media_id = ?1').bind(item.id).all()
    expect(rows.results).toEqual([{ alt: 'Une', caption: 'Légende' }])
    expect((await findMedia(db, item.id))?.focalX).toBe(0.2)

    await insertUsage(db, { mediaId: item.id, entityType: 'article', entityId: 'a1', context: 'cover' })
    await env.DB.prepare('DELETE FROM media WHERE id = ?1').bind(item.id).run()
    const left = await db.select().from(mediaLocalizations)
    expect(left.filter(entry => entry.mediaId === item.id)).toEqual([])
    expect(await listUsages(db, item.id)).toEqual([])
  })
})
