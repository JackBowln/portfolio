// F04-T1: media manifest → uploads → finalize, metadata and soft delete (ADR-0007 §3, §8), and every malicious
// upload rejected. Sessions and the media-usage fixture come from test-only routes (server/api/_test)
import { expect, test } from '@playwright/test'
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test'
import type { Role } from '../../shared/types/enums'
import { SITE_ORIGIN } from '../support/auth'
import { fileOf, POLYGLOT_JPEG, randomSha256, SVG } from '../support/media'
import type { FixtureType } from '../support/media'

const ORIGIN = { origin: SITE_ORIGIN }

interface Upload { name: string, contentType: FixtureType, size: number }
interface Created { id: string, status: string, uploads: Upload[] }

async function session(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, role: Role) {
  const context = await playwright.request.newContext({ baseURL })
  const response = await context.post(`/api/_test/session?role=${role}`, { headers: ORIGIN })
  expect(response.status()).toBe(200)
  return { request: context, userId: (await response.json()).userId as string }
}

function imageManifest(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'image',
    mimeType: 'image/jpeg',
    originalFilename: 'foto da praia.jpg',
    size: 3000,
    width: 1000,
    height: 750,
    sha256: randomSha256(),
    placeholderDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    dominantColor: '#1a2b3c',
    variants: ['avif', 'webp', 'jpeg'].flatMap(format => [320, 640].map(width => ({ format, width, height: width * 0.75, size: 400 + width }))),
    ...overrides,
  }
}

async function create(request: APIRequestContext, manifest: Record<string, unknown>) {
  return request.post('/api/admin/media', { headers: ORIGIN, data: manifest })
}

async function createImage(request: APIRequestContext, overrides: Record<string, unknown> = {}): Promise<Created> {
  const response = await create(request, imageManifest(overrides))
  expect(response.status(), await response.text()).toBe(201)
  return response.json()
}

function put(request: APIRequestContext, id: string, name: string, contentType: string, body: Buffer) {
  return request.put(`/api/admin/media/${id}/variants/${name}`, { headers: { ...ORIGIN, 'content-type': contentType }, data: body })
}

async function uploadAll(request: APIRequestContext, created: Created) {
  for (const upload of created.uploads) {
    const response = await put(request, created.id, upload.name, upload.contentType, fileOf(upload.contentType, upload.size))
    expect(response.status(), `${upload.name}: ${await response.text()}`).toBe(200)
  }
}

async function finalize(request: APIRequestContext, id: string) {
  return request.post(`/api/admin/media/${id}/finalize`, { headers: ORIGIN })
}

async function readyImage(request: APIRequestContext): Promise<Created> {
  const created = await createImage(request)
  await uploadAll(request, created)
  expect((await finalize(request, created.id)).status()).toBe(200)
  return created
}

async function auditActions(request: APIRequestContext, id: string, action: string) {
  const body = await (await request.get('/api/admin/audit', { params: { action, limit: '100' } })).json()
  return (body.entries as { entityId: string, metadata: Record<string, unknown> }[]).filter(entry => entry.entityId === id)
}

test.describe('happy path', () => {
  test('an image goes from manifest to ready, gets metadata per locale and is soft-deleted', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'owner')
    const manifest = imageManifest()
    const response = await create(request, manifest)
    expect(response.status()).toBe(201)
    const created = await response.json() as Created
    expect(created.status).toBe('pending')
    expect(created.uploads.map(upload => upload.name).sort()).toEqual(['avif-320', 'avif-640', 'jpeg-320', 'jpeg-640', 'original', 'webp-320', 'webp-640'])

    await uploadAll(request, created)
    const ready = await finalize(request, created.id)
    expect(ready.status()).toBe(200)
    expect(await ready.json()).toMatchObject({ status: 'ready', uploads: 7 })

    const detail = await (await request.get(`/api/admin/media/${created.id}`)).json()
    const sha = manifest.sha256 as string
    expect(detail).toMatchObject({ status: 'ready', kind: 'image', mimeType: 'image/jpeg', originalFilename: 'foto da praia.jpg' })
    // Keys come from the hash only; the original's key never leaves the server
    expect(detail.variants.map((variant: { key: string }) => variant.key)).toContain(`media/${sha.slice(0, 2)}/${sha}/avif-320.avif`)
    expect(detail).not.toHaveProperty('originalKey')

    const patch = await request.patch(`/api/admin/media/${created.id}`, {
      headers: ORIGIN,
      data: { focalX: 0.25, focalY: 0.8, localizations: { 'pt-BR': { alt: 'Praia ao pôr do sol' }, 'de': { alt: 'Strand bei Sonnenuntergang', credit: 'Foto: [PLACEHOLDER]' } } },
    })
    expect(patch.status(), await patch.text()).toBe(200)
    const updated = await patch.json()
    expect(updated).toMatchObject({ focalX: 0.25, focalY: 0.8 })
    expect(updated.localizations).toEqual(expect.arrayContaining([
      expect.objectContaining({ locale: 'pt-BR', alt: 'Praia ao pôr do sol', translationState: 'source' }),
      expect.objectContaining({ locale: 'de', alt: 'Strand bei Sonnenuntergang', credit: 'Foto: [PLACEHOLDER]', translationState: 'approved' }),
    ]))

    const listed = await (await request.get('/api/admin/media', { params: { q: 'praia', kind: 'image', status: 'ready', limit: '100' } })).json()
    expect(listed.items.map((item: { id: string }) => item.id)).toContain(created.id)

    expect((await request.delete(`/api/admin/media/${created.id}`, { headers: ORIGIN })).status()).toBe(200)
    expect((await request.get(`/api/admin/media/${created.id}`)).status()).toBe(404)

    for (const action of ['media.created', 'media.finalized', 'media.updated', 'media.deleted']) {
      expect(await auditActions(request, created.id, action), action).toHaveLength(1)
    }
    expect((await auditActions(request, created.id, 'media.finalized'))[0]?.metadata).toMatchObject({ uploads: 7 })
    await request.dispose()
  })

  test('a video takes a ready image as poster and WebVTT tracks; the poster is then in use', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'owner')
    const poster = await readyImage(request)
    const created = await (await create(request, {
      kind: 'video', mimeType: 'video/webm', originalFilename: 'demo.webm', size: 5000, width: 1280, height: 720, durationMs: 12_000,
      sha256: randomSha256(), posterMediaId: poster.id, tracks: [{ locale: 'pt-BR', kind: 'captions', label: 'Português', size: 300 }],
    })).json() as Created
    expect(created.uploads.map(upload => [upload.name, upload.contentType])).toEqual([['original', 'video/webm'], ['captions-pt-BR', 'text/vtt']])

    // Markup inside a subtitle file is refused like any other polyglot
    const scripted = Buffer.concat([Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\n<script>alert(1)</script>\n')])
    const padded = Buffer.concat([scripted, Buffer.alloc(300 - scripted.length)])
    expect((await put(request, created.id, 'captions-pt-BR', 'text/vtt', padded)).status()).toBe(415)

    await uploadAll(request, created)
    expect((await finalize(request, created.id)).status()).toBe(200)
    const detail = await (await request.get(`/api/admin/media/${created.id}`)).json()
    expect(detail.tracks).toEqual([expect.objectContaining({ locale: 'pt-BR', kind: 'captions', label: 'Português' })])

    const blocked = await request.delete(`/api/admin/media/${poster.id}`, { headers: ORIGIN })
    expect(blocked.status()).toBe(409)
    expect((await blocked.json()).data.issues).toEqual([{ path: `media:${created.id}:*:poster`, message: 'In use' }])
    await request.dispose()
  })
})

test.describe('rejected uploads', () => {
  test('content that is not what it claims is refused and audited', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'owner')
    const created = await createImage(request, { mimeType: 'image/png' })
    const size = (name: string) => created.uploads.find(upload => upload.name === name)!.size
    const pad = (bytes: Buffer, length: number) => Buffer.concat([bytes, Buffer.alloc(length - bytes.length)])

    const cases: [string, string, string, Buffer, number][] = [
      ['polyglot JPEG/HTML', 'jpeg-320', 'image/jpeg', pad(POLYGLOT_JPEG, size('jpeg-320')), 415],
      ['SVG renamed to .png', 'original', 'image/png', pad(SVG, size('original')), 415],
      ['WebP bytes sent as the JPEG variant', 'jpeg-320', 'image/jpeg', fileOf('image/webp', size('jpeg-320')), 415],
      ['declared MIME differs from the manifest', 'jpeg-320', 'image/webp', fileOf('image/webp', size('jpeg-320')), 415],
      ['body shorter than declared', 'avif-320', 'image/avif', fileOf('image/avif', size('avif-320') - 1), 400],
      ['body longer than declared', 'avif-320', 'image/avif', fileOf('image/avif', size('avif-320') + 1), 400],
      ['variant not in the manifest', 'avif-960', 'image/avif', fileOf('image/avif', 500), 400],
      ['upload name outside the allowed pattern', 'AVIF-320', 'image/avif', fileOf('image/avif', size('avif-320')), 400],
    ]
    for (const [label, name, contentType, body, status] of cases) {
      expect((await put(request, created.id, name, contentType, body)).status(), label).toBe(status)
    }
    // A path cannot be smuggled through the name: the router never reaches the handler with a slash in it
    expect((await put(request, created.id, '..%2F..%2Foriginals', 'image/png', fileOf('image/png', 10))).status()).not.toBe(200)

    const rejected = await auditActions(request, created.id, 'media.upload_rejected')
    // Header mismatches stop before any byte is read; the bytes themselves are what gets audited
    expect(rejected.map(entry => entry.metadata.reason).sort()).toEqual(['markup', 'type_mismatch', 'type_mismatch'])

    // Nothing above reached R2, so finalize still lists every file as missing
    const incomplete = await finalize(request, created.id)
    expect(incomplete.status()).toBe(409)
    expect((await incomplete.json()).data.issues).toHaveLength(created.uploads.length)
    await request.dispose()
  })

  test('manifests over the limits, with SVG or with unknown keys are refused before any upload', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'owner')
    const invalid: [string, Record<string, unknown>][] = [
      ['original over 25 MB', { size: 25_000_001 }],
      ['variant over 10 MB', { variants: [{ format: 'avif', width: 320, height: 240, size: 10_000_001 }] }],
      ['SVG', { mimeType: 'image/svg+xml' }],
      ['client-chosen key', { key: 'media/../evil' }],
      ['path in the file name', { originalFilename: '../index.html' }],
      ['width above the original', { variants: ['avif', 'webp', 'jpeg'].map(format => ({ format, width: 1280, height: 960, size: 10 })) }],
    ]
    for (const [label, overrides] of invalid) {
      expect((await create(request, imageManifest(overrides))).status(), label).toBe(400)
    }
    expect((await create(request, {
      kind: 'video', mimeType: 'video/mp4', originalFilename: 'v.mp4', size: 95_000_001, width: 10, height: 10, durationMs: 1, sha256: randomSha256(), posterMediaId: 'x',
    })).status(), 'video over 95 MB').toBe(400)
    await request.dispose()
  })

  test('the same file is stored once, a finalized item takes no more uploads, and finalize needs every file', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'owner')
    const sha256 = randomSha256()
    const created = await createImage(request, { sha256 })
    const duplicate = await create(request, imageManifest({ sha256 }))
    expect(duplicate.status()).toBe(409)
    expect((await duplicate.json()).data.issues[0].message).toContain(created.id)

    const [first, ...rest] = created.uploads
    await uploadAll(request, { ...created, uploads: rest })
    const missing = await finalize(request, created.id)
    expect(missing.status()).toBe(409)
    expect((await missing.json()).data.issues).toEqual([{ path: first!.name, message: 'Not uploaded' }])

    await uploadAll(request, { ...created, uploads: [first!] })
    expect((await finalize(request, created.id)).status()).toBe(200)
    expect((await put(request, created.id, first!.name, first!.contentType, fileOf(first!.contentType, first!.size))).status()).toBe(409)
    expect((await finalize(request, created.id)).status()).toBe(409)

    const video = await create(request, {
      kind: 'video', mimeType: 'video/mp4', originalFilename: 'v.mp4', size: 100, width: 10, height: 10, durationMs: 1, sha256: randomSha256(), posterMediaId: created.id.replace(/.$/, '0'),
    })
    expect(video.status(), 'poster must be a ready image').toBe(400)
    await request.dispose()
  })
})

test.describe('permissions and request envelope', () => {
  test('media:* is checked on the server for every role', async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({ baseURL })
    expect((await anonymous.get('/api/admin/media')).status()).toBe(401)
    expect((await create(anonymous, imageManifest())).status()).toBe(401)

    const viewer = await session(playwright, baseURL, 'viewer')
    expect((await viewer.request.get('/api/admin/media')).status()).toBe(200)
    expect((await create(viewer.request, imageManifest())).status()).toBe(403)

    const translator = await session(playwright, baseURL, 'translator')
    const owner = await session(playwright, baseURL, 'owner')
    const item = await readyImage(owner.request)
    expect((await translator.request.patch(`/api/admin/media/${item.id}`, { headers: ORIGIN, data: { focalX: 0.1 } })).status()).toBe(403)
    expect((await translator.request.delete(`/api/admin/media/${item.id}`, { headers: ORIGIN })).status()).toBe(403)

    // Authors upload and edit any media, but delete only their own; only the uploader sends files or finalizes
    const author = await session(playwright, baseURL, 'author')
    const other = await session(playwright, baseURL, 'author')
    const own = await createImage(author.request)
    const upload = own.uploads[0]!
    expect((await put(other.request, own.id, upload.name, upload.contentType, fileOf(upload.contentType, upload.size))).status()).toBe(403)
    expect((await finalize(other.request, own.id)).status()).toBe(403)
    expect((await other.request.patch(`/api/admin/media/${own.id}`, { headers: ORIGIN, data: { decorative: true } })).status()).toBe(200)
    expect((await other.request.delete(`/api/admin/media/${own.id}`, { headers: ORIGIN })).status()).toBe(403)
    expect((await author.request.delete(`/api/admin/media/${item.id}`, { headers: ORIGIN })).status()).toBe(403)
    expect((await author.request.delete(`/api/admin/media/${own.id}`, { headers: ORIGIN })).status()).toBe(200)
    // Editors delete any media (matrix: 🟢)
    const editor = await session(playwright, baseURL, 'editor')
    expect((await editor.request.delete(`/api/admin/media/${item.id}`, { headers: ORIGIN })).status()).toBe(200)

    for (const context of [anonymous, viewer.request, translator.request, owner.request, author.request, other.request, editor.request]) {
      await context.dispose()
    }
  })

  test('media in use cannot be deleted; the error lists where it is used', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'owner')
    const item = await readyImage(request)
    // TEST_AUTH-style route: exists only in the test build
    const usage = await request.post('/api/_test/media-usage', { headers: ORIGIN, data: { mediaId: item.id, entityType: 'article', entityId: 'a-1', locale: 'de', context: 'cover' } })
    expect(usage.status()).toBe(200)

    const blocked = await request.delete(`/api/admin/media/${item.id}`, { headers: ORIGIN })
    expect(blocked.status()).toBe(409)
    expect((await blocked.json()).data.issues).toEqual([{ path: 'article:a-1:de:cover', message: 'In use' }])
    expect((await request.get(`/api/admin/media/${item.id}`)).status()).toBe(200)
    await request.dispose()
  })

  test('only the file upload takes a binary body, and it still needs the site origin', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'owner')
    const created = await createImage(request)
    const upload = created.uploads[0]!
    const body = fileOf(upload.contentType, upload.size)

    const crossSite = await request.put(`/api/admin/media/${created.id}/variants/${upload.name}`, { headers: { 'origin': 'https://evil.example', 'content-type': upload.contentType }, data: body })
    expect(crossSite.status()).toBe(403)
    const binaryElsewhere = await request.patch(`/api/admin/media/${created.id}`, { headers: { ...ORIGIN, 'content-type': 'image/jpeg' }, data: body })
    expect(binaryElsewhere.status()).toBe(415)
    const form = await request.post('/api/admin/media', { headers: ORIGIN, form: { kind: 'image' } })
    expect(form.status()).toBe(415)
    await request.dispose()
  })

  test('list and detail queries are strict', async ({ playwright, baseURL }) => {
    const { request } = await session(playwright, baseURL, 'owner')
    for (const params of [{ status: 'deleted' }, { kind: 'svg' }, { limit: '101' }, { missingAlt: 'yes' }, { sort: 'name' }]) {
      expect((await request.get('/api/admin/media', { params })).status(), JSON.stringify(params)).toBe(400)
    }
    const created = await createImage(request)
    for (const data of [{}, { focalX: 2 }, { localizations: { xx: { alt: 'a' } } }, { localizations: { de: {} } }, { status: 'ready' }]) {
      expect((await request.patch(`/api/admin/media/${created.id}`, { headers: ORIGIN, data })).status(), JSON.stringify(data)).toBe(400)
    }
    await request.dispose()
  })
})
