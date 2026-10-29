// F04-T3: media delivery for local and preview (ADR-0007 §5): immutable public caching, the type written at upload,
// Range for video, conditional requests, and nothing but delivered files reachable. Files come from the F04-T1 API
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { fileOf, randomSha256 } from '../support/media'
import type { FixtureType } from '../support/media'

const ORIGIN = { origin: SITE_ORIGIN }

interface Ready { id: string, sha256: string, files: Map<string, Buffer> }

async function ready(request: APIRequestContext, manifest: Record<string, unknown>): Promise<Ready> {
  const created = await request.post('/api/admin/media', { headers: ORIGIN, data: manifest })
  expect(created.status(), await created.text()).toBe(201)
  const { id, uploads } = await created.json() as { id: string, uploads: { name: string, contentType: FixtureType, size: number }[] }
  const files = new Map<string, Buffer>()
  for (const upload of uploads) {
    // Distinct bytes per file, so a wrong object can never pass for the right one
    const body = fileOf(upload.contentType, upload.size, [...Buffer.from(upload.name)])
    files.set(upload.name, body)
    const put = await request.put(`/api/admin/media/${id}/variants/${upload.name}`, { headers: { ...ORIGIN, 'content-type': upload.contentType }, data: body })
    expect(put.status(), upload.name).toBe(200)
  }
  expect((await request.post(`/api/admin/media/${id}/finalize`, { headers: ORIGIN })).status()).toBe(200)
  return { id, sha256: manifest.sha256 as string, files }
}

const imageManifest = () => ({
  kind: 'image',
  mimeType: 'image/jpeg',
  originalFilename: 'entrega.jpg',
  size: 800,
  width: 640,
  height: 480,
  sha256: randomSha256(),
  placeholderDataUrl: 'data:image/webp;base64,UklGRg==',
  dominantColor: '#123456',
  variants: ['avif', 'webp', 'jpeg'].flatMap(format => [320, 640].map(width => ({ format, width, height: width * 0.75, size: 300 + width }))),
})

test.describe('media delivery', () => {
  let image: Ready
  let video: Ready
  const url = (item: Ready, name: string) => `/media/${item.sha256.slice(0, 2)}/${item.sha256}/${name}`

  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext({ baseURL })
    expect((await request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
    image = await ready(request, imageManifest())
    video = await ready(request, {
      kind: 'video', mimeType: 'video/mp4', originalFilename: 'demo.mp4', size: 5000, width: 1280, height: 720, durationMs: 1000,
      sha256: randomSha256(), posterMediaId: image.id, tracks: [{ locale: 'pt-BR', kind: 'captions', label: 'Português', size: 200 }],
    })
    await request.dispose()
  })

  test('a variant is public, immutable, typed from the upload, inline and never sniffed', async ({ request }) => {
    const response = await request.get(url(image, 'avif-320.avif'))
    const headers = response.headers()
    expect(response.status()).toBe(200)
    expect(headers).toMatchObject({
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': 'image/avif',
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
      'cache-tag': `media-file:${image.sha256}`,
      'accept-ranges': 'bytes',
      'content-security-policy': `default-src 'none'; frame-ancestors 'none'`,
    })
    expect(headers['set-cookie']).toBeUndefined()
    expect(headers.etag).toBeTruthy()
    expect(await response.body()).toEqual(image.files.get('avif-320'))
    // Session cookies change nothing: the response stays public and cookie-free
    expect((await request.get(url(image, 'jpeg-640.jpg'), { headers: { cookie: 'portfolio.session_token=x' } })).headers()['set-cookie']).toBeUndefined()
  })

  test('HEAD gives the size without a body; a matching ETag gives 304', async ({ request }) => {
    const head = await request.head(url(image, 'webp-640.webp'))
    expect(head.status()).toBe(200)
    // workerd drops Content-Length from bodiless responses; the type and caching still match GET
    expect(head.headers()).toMatchObject({ 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable' })
    expect((await head.body()).length).toBe(0)

    const etag = (await request.get(url(image, 'webp-640.webp'))).headers().etag!
    const notModified = await request.get(url(image, 'webp-640.webp'), { headers: { 'if-none-match': etag } })
    expect(notModified.status()).toBe(304)
    expect(notModified.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  test('video and tracks are served with Range support', async ({ request }) => {
    const file = video.files.get('original')!
    const first = await request.get(url(video, 'video.mp4'), { headers: { range: 'bytes=0-99' } })
    expect(first.status()).toBe(206)
    expect(first.headers()).toMatchObject({ 'content-type': 'video/mp4', 'content-range': `bytes 0-99/${file.length}`, 'content-length': '100' })
    expect(await first.body()).toEqual(file.subarray(0, 100))

    const tail = await request.get(url(video, 'video.mp4'), { headers: { range: 'bytes=-50' } })
    expect(tail.status()).toBe(206)
    expect(await tail.body()).toEqual(file.subarray(-50))

    const outside = await request.get(url(video, 'video.mp4'), { headers: { range: `bytes=${file.length + 10}-` } })
    expect(outside.status()).toBe(416)
    expect(outside.headers()['content-range']).toBe(`bytes */${file.length}`)

    const track = await request.get(url(video, 'captions-pt-BR.vtt'))
    expect(track.status()).toBe(200)
    expect(track.headers()['content-type']).toBe('text/vtt')
  })

  test('only delivered files are reachable: no original, no traversal, no guessing', async ({ request }) => {
    const sha = image.sha256
    for (const path of [
      `/media/ab/${sha}/original.jpg`,
      `/media/originals/${sha}.jpg`,
      `/media/${sha.slice(0, 2)}/${sha}/..%2F..%2Foriginals%2F${sha}.jpg`,
      `/media/${sha.slice(0, 2)}/${sha}/avif-320.avif%2F..%2F..%2F..%2Foriginals`,
      `/media/${sha.slice(0, 2)}/${sha.toUpperCase()}/avif-320.avif`,
      `/media/${sha.slice(0, 2)}/${sha}/avif-320.svg`,
      `/media/${sha.slice(0, 2)}/${sha}`,
    ]) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(404)
      expect(response.headers()['cache-control'], path).toBe('no-store')
    }
    const unknown = randomSha256()
    expect((await request.get(`/media/${unknown.slice(0, 2)}/${unknown}/avif-320.avif`)).status()).toBe(404)
    expect((await request.post(url(image, 'avif-320.avif'), { headers: ORIGIN })).status()).toBe(405)
  })
})
