// F05-T4: the media of a document resolved for the public renderer on a real D1: the locale's text with the
// source as fallback, a video's poster fetched even when the document does not name it, items that are not ready
// left out, and a document with more items than D1 binds per query still read in one batch (plus one for posters)
import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { mediaLocalizations, users } from '../../server/db/schema'
import type { media } from '../../server/db/schema'
import { resolveDocumentMedia } from '../../server/services/content/document-media'
import { insertMedia, markReady, softDeleteMedia } from '../../server/services/media/media.repo'
import type { DocumentJson } from '../../shared/content/document-schema'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Document media tester', email: `document-media-${uuidv7()}@example.test` }).returning()
const sha = () => [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')

async function image(alt?: { 'pt-BR': string, 'en'?: string }, ready = true) {
  const hash = sha()
  const row: typeof media.$inferInsert = {
    id: uuidv7(),
    kind: 'image',
    mimeType: 'image/jpeg',
    originalFilename: 'foto.jpg',
    sizeBytes: 100,
    width: 1000,
    height: 750,
    sha256: hash,
    originalKey: `originals/${hash}.jpg`,
    variants: [{ name: 'webp-320', format: 'webp', width: 320, height: 240, size: 10, key: `media/${hash.slice(0, 2)}/${hash}/webp-320.webp` }],
  }
  await insertMedia(db, row, [])
  if (alt) {
    await db.insert(mediaLocalizations).values(Object.entries(alt).map(([locale, text]) => ({ mediaId: row.id!, locale: locale as 'en', alt: text, translationState: 'approved' as const })))
  }
  if (ready) {
    await markReady(db, row.id!)
  }
  return row.id!
}

async function video(posterId: string) {
  const hash = sha()
  const id = uuidv7()
  await insertMedia(db, { id, kind: 'video', mimeType: 'video/mp4', originalFilename: 'clipe.mp4', sizeBytes: 100, width: 1280, height: 720, durationMs: 1000, sha256: hash, originalKey: `media/${hash.slice(0, 2)}/${hash}/video.mp4`, variants: [], posterMediaId: posterId }, [
    { locale: 'pt-BR', kind: 'captions', label: 'Português', key: `media/${hash.slice(0, 2)}/${hash}/captions-pt-BR.vtt`, size: 10 },
  ])
  await markReady(db, id, { mediaId: posterId })
  return id
}

const doc = (...content: unknown[]) => ({ type: 'doc', content }) as DocumentJson
const imageBlock = (mediaId: string, id = uuidv7()) => ({ type: 'image', attrs: { id: `img-${id}`, mediaId } })

/** Counts D1 round trips: one batch or one statement each */
function countingDb() {
  const counter = { batches: 0, statements: 0 }
  const d1 = new Proxy(env.DB, {
    get(target, property) {
      const value = Reflect.get(target, property) as unknown
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          counter.batches++
          return target.batch(statements)
        }
      }
      if (property === 'prepare') {
        return (query: string) => {
          counter.statements++
          return target.prepare(query)
        }
      }
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  return { db: createDb(d1), counter }
}

describe('resolveDocumentMedia', () => {
  it('gives each item the locale\'s text, or the source locale\'s, and the poster and tracks of a video', async () => {
    const translated = await image({ 'pt-BR': 'Foto', 'en': 'Photo' })
    const source = await image({ 'pt-BR': 'Só em português' })
    const poster = await image({ 'pt-BR': 'Capa', 'en': 'Poster' })
    const clip = await video(poster)
    const document = doc(imageBlock(translated), imageBlock(source), { type: 'video', attrs: { id: 'v', mediaId: clip } })

    const map = await resolveDocumentMedia(db, document, 'en')
    expect(Object.keys(map).sort()).toEqual([translated, source, clip].sort())
    expect(map[translated]).toMatchObject({ kind: 'image', image: { alt: 'Photo', width: 1000 } })
    expect(map[source]).toMatchObject({ kind: 'image', image: { alt: 'Só em português' } })
    const resolved = map[clip]
    expect(resolved?.kind).toBe('video')
    if (resolved?.kind === 'video') {
      expect(resolved.video.poster?.alt).toBe('Poster')
      expect(resolved.video.tracks).toEqual([{ locale: 'pt-BR', kind: 'captions', label: 'Português', key: expect.stringMatching(/captions-pt-BR\.vtt$/) }])
      expect(resolved.video.key).toMatch(/video\.mp4$/)
    }
  })

  it('leaves out pending, deleted and unknown items', async () => {
    const pending = await image({ 'pt-BR': 'Pendente' }, false)
    const deleted = await image({ 'pt-BR': 'Apagada' })
    await softDeleteMedia(db, deleted, user!.id)
    const ready = await image({ 'pt-BR': 'Pronta' })
    const map = await resolveDocumentMedia(db, doc(imageBlock(pending), imageBlock(deleted), imageBlock(uuidv7()), imageBlock(ready)), 'pt-BR')
    expect(Object.keys(map)).toEqual([ready])
  })

  it('reads a document with 120 items in one batch, plus one for video posters', async () => {
    const ids = await Promise.all(Array.from({ length: 120 }, (_, index) => image({ 'pt-BR': `Foto ${index}` })))
    const poster = await image({ 'pt-BR': 'Capa' })
    const clip = await video(poster)
    const galleries = Array.from({ length: 5 }, (_, index) => ({ type: 'gallery', attrs: { id: `g-${index}`, layout: 'grid', items: ids.slice(index * 24, index * 24 + 24) } }))
    const { db: counted, counter } = countingDb()

    const map = await resolveDocumentMedia(counted, doc(...galleries, { type: 'video', attrs: { id: 'v', mediaId: clip } }), 'pt-BR')
    expect(Object.keys(map)).toHaveLength(121)
    expect(counter.batches).toBe(2)
    expect(map[ids[119]!]).toMatchObject({ kind: 'image', image: { alt: 'Foto 119' } })

    const { db: plain, counter: plainCounter } = countingDb()
    await resolveDocumentMedia(plain, doc(imageBlock(ids[0]!)), 'pt-BR')
    expect(plainCounter.batches).toBe(1)
  })
})
