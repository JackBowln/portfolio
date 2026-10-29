// F04-T4: the media library end to end (RF-06.3–RF-06.6): upload → alt in 5 locales → focal point by keyboard →
// deleting media in use is refused with its uses → deleting unused media; filters; and a video with a poster
// chosen in the media picker and WebVTT captions. The WebM is recorded by Chromium itself (canvas + MediaRecorder)
import { randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { fileOf, randomSha256 } from '../support/media'
import { photo } from '../support/photo'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Uploads run the admin pipeline in desktop Chromium')

const ORIGIN = { origin: SITE_ORIGIN }
const tag = () => randomBytes(3).toString('hex')

async function signIn(page: Page) {
  // TEST_AUTH route: exists only in the test build
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
}

async function uploadPhoto(page: Page, name: string, width = 900, height = 600): Promise<string> {
  await page.goto('/admin/midia')
  await page.getByLabel('Escolher imagem', { exact: true }).setInputFiles({ name, mimeType: 'image/jpeg', buffer: await photo(page.context().browser()!, width, height) })
  await expect(page.getByRole('status').filter({ hasText: `Imagem enviada: ${name}` })).toBeVisible({ timeout: 90_000 })
  const row = page.getByTestId('media-row').filter({ hasText: name })
  await expect(row).toBeVisible()
  return (await row.getAttribute('data-media-id'))!
}

/** A ready image registered straight through the API: enough for lists and deletion, no pipeline needed */
async function apiImage(request: APIRequestContext, name: string): Promise<string> {
  const created = await (await request.post('/api/admin/media', {
    headers: ORIGIN,
    data: {
      kind: 'image', mimeType: 'image/jpeg', originalFilename: name, size: 500, width: 320, height: 240, sha256: randomSha256(),
      placeholderDataUrl: 'data:image/webp;base64,UklGRg==', dominantColor: '#334455',
      variants: ['avif', 'webp', 'jpeg'].map(format => ({ format, width: 320, height: 240, size: 300 })),
    },
  })).json() as { id: string, uploads: { name: string, contentType: 'image/jpeg', size: number }[] }
  for (const upload of created.uploads) {
    await request.put(`/api/admin/media/${created.id}/variants/${upload.name}`, { headers: { ...ORIGIN, 'content-type': upload.contentType }, data: fileOf(upload.contentType, upload.size) })
  }
  expect((await request.post(`/api/admin/media/${created.id}/finalize`, { headers: ORIGIN })).status()).toBe(200)
  return created.id
}

test('upload, alt in five locales, focal point by keyboard, blocked and allowed deletion', async ({ page }) => {
  test.setTimeout(180_000)
  await signIn(page)
  const request = page.context().request
  const name = `biblioteca-${tag()}.jpg`
  const id = await uploadPhoto(page, name)

  await page.getByTestId('media-row').filter({ hasText: name }).getByRole('link').click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'ainda não tem texto alternativo' })).toBeVisible()

  // pt-BR is required for an informative image
  await page.getByRole('button', { name: 'Salvar textos' }).click()
  await expect(page.locator('[data-locale="pt-BR"]').getByText('Escreva o texto alternativo em português')).toBeVisible()

  const alts = { 'pt-BR': 'Praia ao pôr do sol', 'en': 'Beach at sunset', 'es': 'Playa al atardecer', 'de': 'Strand bei Sonnenuntergang', 'fr': 'Plage au coucher du soleil' }
  for (const [locale, alt] of Object.entries(alts)) {
    const group = page.locator(`[data-locale="${locale}"]`)
    if (locale !== 'pt-BR') {
      await group.locator('summary').click()
    }
    await group.getByLabel('Texto alternativo (alt)').fill(alt)
  }
  await page.locator('[data-locale="de"]').getByLabel('Crédito').fill('Foto: [PLACEHOLDER]')
  await page.getByRole('button', { name: 'Salvar textos' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Textos salvos.' })).toBeVisible()
  await expect(page.getByText('ainda não tem texto alternativo')).toBeHidden()

  // Focal point with the keyboard only: 10 steps right, 20 steps down from the center
  const horizontal = page.getByRole('slider', { name: /Foco horizontal/ })
  await horizontal.focus()
  for (let step = 0; step < 10; step++) {
    await page.keyboard.press('ArrowRight')
  }
  const vertical = page.getByRole('slider', { name: /Foco vertical/ })
  await vertical.focus()
  for (let step = 0; step < 20; step++) {
    await page.keyboard.press('ArrowRight')
  }
  await expect(horizontal).toHaveAttribute('aria-valuetext', '60%')
  await page.getByRole('button', { name: 'Salvar foco' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Ponto de foco salvo.' })).toBeVisible()

  const detail = await (await request.get(`/api/admin/media/${id}`)).json()
  expect(detail).toMatchObject({ focalX: 0.6, focalY: 0.7 })
  expect(Object.fromEntries(detail.localizations.map((item: { locale: string, alt: string }) => [item.locale, item.alt]))).toEqual(alts)
  expect(detail.localizations.find((item: { locale: string }) => item.locale === 'de')).toMatchObject({ credit: 'Foto: [PLACEHOLDER]', translationState: 'approved' })

  // Used elsewhere after the page loaded: the server refuses and the page shows where it is used
  expect((await request.post('/api/_test/media-usage', { headers: ORIGIN, data: { mediaId: id, entityType: 'article', entityId: 'a-42', locale: 'de', context: 'cover' } })).status()).toBe(200)
  await page.getByRole('button', { name: 'Excluir mídia' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Excluir esta mídia?' })
  await expect(confirm).toBeVisible()
  await expect(confirm.getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await confirm.getByRole('button', { name: 'Excluir' }).click()
  await expect(page.getByRole('alert')).toHaveText(/A mídia está em uso e não foi excluída/)
  await expect(page.getByTestId('media-usages')).toContainText('article a-42')
  await expect(page.getByTestId('media-usages')).toContainText('como capa')
  await expect(page.getByRole('button', { name: 'Excluir mídia' })).toBeDisabled()
  expect((await request.get(`/api/admin/media/${id}`)).status()).toBe(200)

  // Unused media goes
  const unused = await apiImage(request, `sem-uso-${tag()}.jpg`)
  await page.goto(`/admin/midia/${unused}`)
  await page.getByRole('button', { name: 'Excluir mídia' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click()
  await expect(page).toHaveURL('/admin/midia')
  expect((await request.get(`/api/admin/media/${unused}`)).status()).toBe(404)
})

test('filters by name, kind, missing alt and period, through the query string', async ({ page }) => {
  await signIn(page)
  const request = page.context().request
  const marker = tag()
  const withAlt = await apiImage(request, `filtro-${marker}-com-alt.jpg`)
  await request.patch(`/api/admin/media/${withAlt}`, { headers: ORIGIN, data: { localizations: { 'pt-BR': { alt: 'Uma foto' } } } })
  await apiImage(request, `filtro-${marker}-sem-alt.jpg`)

  await page.goto('/admin/midia')
  await page.getByLabel('Nome do arquivo', { exact: true }).fill(`filtro-${marker}`)
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`q=filtro-${marker}`))
  await expect(page.getByTestId('media-row')).toHaveCount(2)
  await expect(page.getByTestId('media-row').filter({ hasText: 'sem-alt' })).toContainText('Sem alt')

  await page.getByLabel('Só imagens sem texto alternativo').check()
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByTestId('media-row')).toHaveCount(1)
  await expect(page.getByTestId('media-row')).toContainText('sem-alt')

  await page.getByLabel('Tipo').selectOption('video')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByText('Nenhuma mídia com estes filtros.')).toBeVisible()

  // Reloading keeps the filters; a period in the future finds nothing; clearing brings the library back
  await page.goto(`/admin/midia?q=filtro-${marker}&from=2999-01-01`)
  await expect(page.getByLabel('Nome do arquivo', { exact: true })).toHaveValue(`filtro-${marker}`)
  await expect(page.getByText('Nenhuma mídia com estes filtros.')).toBeVisible()
  await page.getByRole('button', { name: 'Limpar filtros' }).click()
  await expect(page).toHaveURL('/admin/midia')
  await expect(page.getByTestId('media-row').first()).toBeVisible()
})

test('a video takes a poster from the picker, captions per locale, and then keeps the poster in use', async ({ page }) => {
  test.setTimeout(180_000)
  await signIn(page)
  const request = page.context().request
  const posterName = `poster-${tag()}.jpg`
  const posterId = await uploadPhoto(page, posterName, 960, 540)

  // A real WebM, recorded from a canvas; its header has no duration, as with many encoders
  const webm = Buffer.from(await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 320, height: 180 })
    const context = canvas.getContext('2d')!
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm' })
    const chunks: Blob[] = []
    recorder.ondataavailable = event => chunks.push(event.data)
    const stopped = new Promise(resolve => (recorder.onstop = resolve))
    recorder.start()
    for (let frame = 0; frame < 36; frame++) {
      context.fillStyle = `hsl(${frame * 10} 70% 50%)`
      context.fillRect(0, 0, 320, 180)
      await new Promise(resolve => setTimeout(resolve, 33))
    }
    recorder.stop()
    await stopped
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
    return [...bytes]
  }))
  const videoName = `video-${tag()}.webm`

  await page.getByLabel('Arquivo de vídeo').setInputFiles({ name: videoName, mimeType: 'video/webm', buffer: webm })
  await page.getByRole('button', { name: 'Enviar vídeo' }).click()
  await expect(page.getByText('Escolha um poster.')).toBeVisible()

  // The picker by keyboard: open, search, choose, and focus comes back to the opener
  const opener = page.getByRole('button', { name: 'Escolher poster' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const picker = page.getByRole('dialog', { name: 'Escolher da biblioteca' })
  await expect(picker).toBeVisible()
  await picker.getByLabel('Buscar pelo nome do arquivo').fill(posterName)
  await page.keyboard.press('Enter')
  await expect(picker.getByTestId('picker-item')).toHaveCount(1)
  await picker.getByRole('button', { name: `Escolher ${posterName}` }).focus()
  await page.keyboard.press('Enter')
  await expect(picker).toBeHidden()
  await expect(page.getByTestId('video-poster')).toHaveText(`Poster escolhido: ${posterName}`)

  await page.locator('input[data-locale="pt-BR"]').setInputFiles({ name: 'pt.vtt', mimeType: 'text/vtt', buffer: Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nOlá\n') })
  await page.getByRole('button', { name: 'Enviar vídeo' }).click()
  await expect(page.getByRole('status').filter({ hasText: `Vídeo enviado: ${videoName}` })).toBeVisible({ timeout: 60_000 })

  const listed = await (await request.get('/api/admin/media', { params: { kind: 'video', q: videoName } })).json()
  const videoId = listed.items[0].id as string
  const detail = await (await request.get(`/api/admin/media/${videoId}`)).json()
  expect(detail).toMatchObject({ kind: 'video', mimeType: 'video/webm', width: 320, height: 180, posterMediaId: posterId, status: 'ready' })
  expect(detail.durationMs).toBeGreaterThan(500)
  expect(detail.tracks).toEqual([expect.objectContaining({ locale: 'pt-BR', kind: 'captions', label: 'Português (Brasil)' })])
  expect(detail.fileKey).toMatch(/\/video\.webm$/)

  await page.goto(`/admin/midia/${videoId}`)
  await expect(page.locator('video')).toHaveAttribute('preload', 'none')
  await page.goto(`/admin/midia/${posterId}`)
  await expect(page.getByTestId('media-usages')).toContainText('como poster')
  await expect(page.getByRole('button', { name: 'Excluir mídia' })).toBeDisabled()
})

test('the library and the detail fit 360 px without horizontal scroll', async ({ page }) => {
  await signIn(page)
  const id = await apiImage(page.context().request, `estreita-${tag()}.jpg`)
  await page.setViewportSize({ width: 360, height: 780 })
  for (const path of ['/admin/midia', `/admin/midia/${id}`]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, path).toBe(0)
  }
})
