// F04-T3: real images through the admin pipeline, rendered by <ResponsiveImage> and <MediaVideo> on the test page
// (app/pages/_test/media.vue, test build only): the browser picks AVIF, nothing shifts, lazy images wait, and the
// video downloads nothing until played while its tracks are selectable
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { fileOf, randomSha256 } from '../support/media'
import { photo } from '../support/photo'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Uploads run the admin pipeline in desktop Chromium')

const ORIGIN = { origin: SITE_ORIGIN }

async function uploadPhoto(page: Page, file: Buffer): Promise<string> {
  const name = `entrega-${randomBytes(3).toString('hex')}.jpg`
  await page.goto('/admin/midia')
  await page.getByLabel('Escolher imagem').setInputFiles({ name, mimeType: 'image/jpeg', buffer: file })
  const row = page.getByTestId('media-row').filter({ hasText: name })
  // Listed once finalized; only unfinished items carry the "Incompleta" tag
  await expect(row).toBeVisible({ timeout: 90_000 })
  await expect(row).not.toContainText('Incompleta')
  return (await row.getAttribute('data-media-id'))!
}

test('real variants render as AVIF without layout shift, with lazy images left for later', async ({ page, browser }) => {
  test.setTimeout(240_000)
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  const lcp = await uploadPhoto(page, await photo(browser, 2000, 1200))
  const lazy = await uploadPhoto(page, await photo(browser, 1000, 1000))

  await page.addInitScript(() => {
    const state = window as unknown as { shifts: number }
    state.shifts = 0
    new PerformanceObserver(list => list.getEntries().forEach((entry) => {
      state.shifts += (entry as unknown as { value: number }).value
    })).observe({ type: 'layout-shift', buffered: true })
  })
  const requested: string[] = []
  page.on('request', request => request.url().includes('/media/') && requested.push(request.url()))
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/_test/media?lcp=${lcp}&images=${lazy}`)

  const hero = page.getByTestId('lcp-image').locator('img')
  await expect.poll(() => hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  expect(await hero.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\/media\/[0-9a-f]{2}\/[0-9a-f]{64}\/avif-\d+\.avif$/)
  await expect(hero).toHaveAttribute('fetchpriority', 'high')
  expect(await page.evaluate(() => (window as unknown as { shifts: number }).shifts)).toBe(0)

  // The other image is lazy and async, and never requested before the LCP image
  const below = page.getByTestId('lazy-image').locator('img')
  await expect(below).toHaveAttribute('loading', 'lazy')
  await expect(below).not.toHaveAttribute('fetchpriority', /.+/)
  const heroSha = (await hero.getAttribute('srcset'))!.split(' ')[0]!.split('/media/')[1]!.split('/')[1]!
  const lazySha = (await below.getAttribute('srcset'))!.split(' ')[0]!.split('/media/')[1]!.split('/')[1]!
  const firstLazy = requested.findIndex(url => url.includes(lazySha))
  expect(requested.findIndex(url => url.includes(heroSha))).toBeLessThan(firstLazy === -1 ? Infinity : firstLazy)
  await below.scrollIntoViewIfNeeded()
  await expect.poll(() => below.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  expect(await below.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\.avif$/)
  expect(await page.evaluate(() => (window as unknown as { shifts: number }).shifts)).toBe(0)
})

test('the video loads nothing until played and lists its tracks', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const request = page.context().request
  expect((await request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  const poster = await uploadPhoto(page, await photo(browser, 1280, 720))

  // A video registered through the API; its bytes are a signature only, enough for delivery and tracks
  const created = await (await request.post('/api/admin/media', {
    headers: ORIGIN,
    data: {
      kind: 'video', mimeType: 'video/mp4', originalFilename: 'demo.mp4', size: 4000, width: 1280, height: 720, durationMs: 1000, sha256: randomSha256(), posterMediaId: poster,
      tracks: [{ locale: 'pt-BR', kind: 'captions', label: 'Português', size: 60 }, { locale: 'en', kind: 'subtitles', label: 'English', size: 60 }],
    },
  })).json() as { id: string, uploads: { name: string, contentType: 'video/mp4' | 'text/vtt', size: number }[] }
  for (const upload of created.uploads) {
    const response = await request.put(`/api/admin/media/${created.id}/variants/${upload.name}`, { headers: { ...ORIGIN, 'content-type': upload.contentType }, data: fileOf(upload.contentType, upload.size) })
    expect(response.status(), upload.name).toBe(200)
  }
  expect((await request.post(`/api/admin/media/${created.id}/finalize`, { headers: ORIGIN })).status()).toBe(200)

  const fetched: string[] = []
  page.on('request', item => fetched.push(item.url()))
  await page.goto(`/_test/media?video=${created.id}`)
  const video = page.getByTestId('video')
  await expect(video).toHaveAttribute('preload', 'none')
  expect(await video.getAttribute('autoplay')).toBeNull()
  await page.waitForLoadState('networkidle')
  expect(fetched.filter(url => url.endsWith('/video.mp4'))).toEqual([])
  expect(fetched.some(url => /\/jpeg-\d+\.jpg$/.test(url))).toBe(true)

  const tracks = await video.evaluate((element: HTMLVideoElement) => [...element.textTracks].map(track => ({ language: track.language, kind: track.kind, label: track.label, mode: track.mode })))
  // Ordered by locale; the page is pt-BR, so its captions show by default
  expect(tracks).toEqual([
    { language: 'en', kind: 'subtitles', label: 'English', mode: 'disabled' },
    { language: 'pt-BR', kind: 'captions', label: 'Português', mode: 'showing' },
  ])
})
