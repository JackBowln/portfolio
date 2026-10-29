// Ready media through the admin API, without the image pipeline: the server checks signatures and sizes only, so
// the bytes are fixtures (fileOf). For tests that need library items fast (editor E2E and axe)
import { randomBytes } from 'node:crypto'
import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { SITE_ORIGIN } from './auth'
import { fileOf, randomSha256 } from './media'
import type { FixtureType } from './media'

const ORIGIN = { origin: SITE_ORIGIN }

export const uniqueName = (prefix: string, extension: string) => `${prefix}-${randomBytes(3).toString('hex')}.${extension}`

async function createReady(request: APIRequestContext, manifest: Record<string, unknown>): Promise<string> {
  const response = await request.post('/api/admin/media', { headers: ORIGIN, data: manifest })
  expect(response.status(), await response.text()).toBe(201)
  const created = await response.json() as { id: string, uploads: { name: string, contentType: FixtureType, size: number }[] }
  for (const upload of created.uploads) {
    const put = await request.put(`/api/admin/media/${created.id}/variants/${upload.name}`, { headers: { ...ORIGIN, 'content-type': upload.contentType }, data: fileOf(upload.contentType, upload.size) })
    expect(put.status(), upload.name).toBe(200)
  }
  expect((await request.post(`/api/admin/media/${created.id}/finalize`, { headers: ORIGIN })).status()).toBe(200)
  return created.id
}

export function readyImage(request: APIRequestContext, originalFilename: string): Promise<string> {
  return createReady(request, {
    kind: 'image',
    mimeType: 'image/jpeg',
    originalFilename,
    size: 3000,
    width: 1000,
    height: 750,
    sha256: randomSha256(),
    placeholderDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    dominantColor: '#1a2b3c',
    variants: ['avif', 'webp', 'jpeg'].flatMap(format => [320, 640].map(width => ({ format, width, height: width * 0.75, size: 400 + width }))),
  })
}

export function readyVideo(request: APIRequestContext, originalFilename: string, posterMediaId: string): Promise<string> {
  return createReady(request, {
    kind: 'video',
    mimeType: 'video/mp4',
    originalFilename,
    size: 4000,
    width: 1280,
    height: 720,
    durationMs: 1000,
    sha256: randomSha256(),
    posterMediaId,
    tracks: [],
  })
}

/** The content test page (F05-T4) with fresh library media for every image, gallery, video and poster slot */
export async function contentFixturePath(request: APIRequestContext): Promise<string> {
  expect((await request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  const poster = await readyImage(request, uniqueName('capa', 'jpg'))
  const ids = {
    photo: await readyImage(request, uniqueName('foto', 'jpg')),
    second: await readyImage(request, uniqueName('segunda', 'jpg')),
    third: await readyImage(request, uniqueName('terceira', 'jpg')),
    clip: await readyVideo(request, uniqueName('clipe', 'mp4'), poster),
    poster,
  }
  return `/_test/content?${new URLSearchParams(ids)}`
}
