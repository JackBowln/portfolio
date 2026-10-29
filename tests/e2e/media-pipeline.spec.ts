// F04-T2: the admin image pipeline end to end in Chromium (ADR-0007 §2): no EXIF/GPS leaves the browser, the
// output is the same for the same file, a 4000×3000 photo does not block the page, and the upload lands in the API.
// Fixtures are generated here (a screenshot JPEG plus an EXIF/GPS block), so no binary lives in the repository
import { createHash, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { hasLocationMetadata } from '../support/media'
import { photo } from '../support/photo'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Pipeline checks run in desktop Chromium')

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

async function signIn(page: Page) {
  // TEST_AUTH route: exists only in the test build
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
}

/** Every body the page PUTs, by upload name; `fake` answers the API calls without reaching the server */
async function captureUploads(page: Page, { fake = false } = {}) {
  const bodies = new Map<string, Buffer>()
  const manifests: Record<string, unknown>[] = []
  await page.route('**/api/admin/media', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue()
    }
    manifests.push(route.request().postDataJSON())
    if (!fake) {
      return route.continue()
    }
    const manifest = manifests.at(-1) as { variants: { format: string, width: number, size: number }[], mimeType: string, size: number }
    const uploads = [{ name: 'original', contentType: manifest.mimeType, size: manifest.size }, ...manifest.variants.map(variant => ({ name: `${variant.format}-${variant.width}`, contentType: `image/${variant.format}`, size: variant.size }))]
    return route.fulfill({ status: 201, json: { id: 'fake', status: 'pending', uploads } })
  })
  await page.route('**/api/admin/media/*/variants/*', async (route) => {
    bodies.set(decodeURIComponent(route.request().url().split('/').pop()!), route.request().postDataBuffer()!)
    return fake ? route.fulfill({ json: { ok: true } }) : route.continue()
  })
  await page.route('**/api/admin/media/*/finalize', route => fake ? route.fulfill({ json: { status: 'ready' } }) : route.continue())
  return { bodies, manifests }
}

async function upload(page: Page, file: Buffer, name: string) {
  await page.getByLabel('Escolher imagem').setInputFiles({ name, mimeType: 'image/jpeg', buffer: file })
}

test('a photo with GPS is processed, uploaded without metadata and listed', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const file = await photo(browser, 1400, 1050)
  expect(hasLocationMetadata(file)).toBe(true)
  await signIn(page)
  await page.goto('/admin/midia')
  const { bodies, manifests } = await captureUploads(page)

  // Unique per run: earlier runs left rows in the local database
  const name = `praia-com-gps-${randomBytes(3).toString('hex')}.jpg`
  await upload(page, file, name)
  await expect(page.getByRole('status').filter({ hasText: `Imagem enviada: ${name}` })).toBeVisible({ timeout: 90_000 })

  // 1400 px wide: 320, 640, 960 and 1280, in three formats, plus the original
  expect([...bodies.keys()].sort()).toEqual(['avif-1280', 'avif-320', 'avif-640', 'avif-960', 'jpeg-1280', 'jpeg-320', 'jpeg-640', 'jpeg-960', 'original', 'webp-1280', 'webp-320', 'webp-640', 'webp-960'])
  for (const [name, body] of bodies) {
    expect(hasLocationMetadata(body), name).toBe(false)
  }
  const manifest = manifests[0] as { sha256: string, width: number, height: number, placeholderDataUrl: string, dominantColor: string }
  expect(manifest).toMatchObject({ width: 1400, height: 1050 })
  expect(manifest.sha256).toBe(sha(bodies.get('original')!))
  expect(manifest.placeholderDataUrl).toMatch(/^data:image\/webp;base64,/)
  expect(manifest.dominantColor).toMatch(/^#[0-9a-f]{6}$/)

  const row = page.getByTestId('media-row').filter({ hasText: name })
  await expect(row).toContainText('Pronta')
  await expect(row).toContainText('1400 × 1050 px')
  const id = await row.getAttribute('data-media-id')
  const detail = await (await page.context().request.get(`/api/admin/media/${id}`)).json()
  expect(detail.status).toBe('ready')
  expect(detail.variants).toHaveLength(12)
})

test('the same file gives byte-identical variants', async ({ page, browser }) => {
  test.setTimeout(150_000)
  const file = await photo(browser, 700, 500)
  await signIn(page)
  await page.goto('/admin/midia')
  const { bodies } = await captureUploads(page, { fake: true })
  const runs: Record<string, string>[] = []
  for (let run = 0; run < 2; run++) {
    bodies.clear()
    await upload(page, file, 'mesma.jpg')
    await expect(page.getByRole('status').filter({ hasText: 'Imagem enviada: mesma.jpg' })).toBeVisible({ timeout: 60_000 })
    runs.push(Object.fromEntries([...bodies].map(([name, body]) => [name, sha(body)])))
  }
  expect(Object.keys(runs[0]!)).toHaveLength(7)
  expect(runs[1]).toEqual(runs[0])
})

test('a 4000×3000 photo is processed in the worker without blocking the page', async ({ page, browser }) => {
  test.setTimeout(300_000)
  const file = await photo(browser, 4000, 3000)
  await signIn(page)
  await page.goto('/admin/midia')
  await captureUploads(page, { fake: true })
  await page.evaluate(() => {
    const state = window as unknown as { longTasks: number[], frames: number }
    state.longTasks = []
    state.frames = 0
    new PerformanceObserver(list => state.longTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: 'longtask' })
    const tick = () => {
      state.frames++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  const started = Date.now()
  await upload(page, file, 'grande.jpg')
  await expect(page.getByTestId('media-progress')).toContainText('Gerando variantes', { timeout: 60_000 })
  const framesBefore = await page.evaluate(() => (window as unknown as { frames: number }).frames)
  const done = page.getByRole('status').filter({ hasText: 'Imagem enviada: grande.jpg' })
  await expect(done).toBeVisible({ timeout: 280_000 })
  const elapsed = Date.now() - started

  const { longTasks, frames } = await page.evaluate(() => {
    const state = window as unknown as { longTasks: number[], frames: number }
    return { longTasks: state.longTasks, frames: state.frames }
  })
  test.info().annotations.push({ type: 'pipeline-4000x3000-ms', description: String(elapsed) }, { type: 'longest-main-thread-task-ms', description: String(Math.max(0, ...longTasks)) })
  console.log(`[F04-T2] 4000×3000: ${elapsed} ms end to end; ${await done.textContent()}; longest main-thread task ${Math.round(Math.max(0, ...longTasks))} ms; frames during processing ${frames - framesBefore}`)
  expect(Math.max(0, ...longTasks)).toBeLessThan(200)
  expect(frames - framesBefore).toBeGreaterThan(30)
})

test('cancelling stops the work before anything is sent', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const file = await photo(browser, 3000, 2000)
  await signIn(page)
  await page.goto('/admin/midia')
  const { manifests } = await captureUploads(page, { fake: true })

  await upload(page, file, 'cancelar.jpg')
  await expect(page.getByTestId('media-progress')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Envio cancelado.' })).toBeVisible()
  await expect(page.getByTestId('media-progress')).toBeHidden()
  await expect(page.getByLabel('Escolher imagem')).toBeEnabled()
  expect(manifests).toEqual([])
})

test('the media screen works by keyboard', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/midia')
  const input = page.getByLabel('Escolher imagem')
  // Skip link, then the header (navigation and sign-out), then the first control of the page
  for (let step = 0; step < 15 && !(await input.evaluate(element => element === document.activeElement)); step++) {
    await page.keyboard.press('Tab')
  }
  await expect(input).toBeFocused()
  await expect(input).toHaveAccessibleDescription('JPEG, PNG, WebP ou AVIF, até 25 MB. O processamento acontece neste dispositivo.')
})

test('a file that is not an image is refused with a message', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/midia')
  await page.getByLabel('Escolher imagem').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') })
  await expect(page.getByRole('alert')).toHaveText('Formato não aceito. Use JPEG, PNG, WebP ou AVIF.')
})
