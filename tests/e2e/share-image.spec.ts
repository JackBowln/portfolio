// F11-T2: the share image generated in the browser when publishing. Publishing an article with accents of the 5
// locales draws a 1200 × 630 JPEG (≤ 300 KB, with its 1200 px variant), uploads it as a decorative media named after
// the article, locale and title, and the public page points og:image at it with its size and the title as alt.
// Publishing again with the same title keeps it; a new title makes a new one; an image chosen by hand stays
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { expectNoBlockingViolations } from '../support/axe'
import { readyImage, uniqueName } from '../support/media-api'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'The article editor runs in desktop Chromium here')

// The image pipeline encodes AVIF, WebP and JPEG at four widths in a Web Worker
test.setTimeout(120_000)

const ORIGIN = { origin: SITE_ORIGIN }

async function openNew(page: Page, title: string) {
  expect((await page.context().request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  await page.goto('/admin/artigos')
  await page.getByRole('textbox', { name: 'Título do novo artigo' }).fill(title)
  await page.getByRole('button', { name: 'Criar e abrir' }).click()
  await expect(page.getByRole('textbox', { name: 'Corpo do artigo' })).toBeVisible()
  return page.url().split('/').at(-1)!
}

const sourceOf = async (request: APIRequestContext, id: string) => (await (await request.get(`/api/admin/articles/${id}`)).json()).localizations.find((copy: { locale: string }) => copy.locale === 'pt-BR')

async function publish(page: Page, name: string) {
  await page.getByRole('button', { name }).click()
  await expect(page.getByText('Artigo publicado.')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByTestId('share-image-warning')).toBeHidden()
}

test('publishing makes the share image and og:image points at it', async ({ page }) => {
  const title = `Ação über façade straße niño œuvre ${uniqueName('og', 'x')}`
  const id = await openNew(page, title)
  const request = page.context().request
  await publish(page, 'Publicar agora')

  const copy = await sourceOf(request, id)
  expect(copy.ogImageMediaId).toBeTruthy()
  const media = await (await request.get(`/api/admin/media/${copy.ogImageMediaId}`)).json()
  expect(media.originalFilename).toMatch(new RegExp(`^og-article-${id}-pt-BR-[0-9a-f]{16}\\.jpg$`))
  expect(media).toMatchObject({ kind: 'image', status: 'ready', width: 1200, height: 630, decorative: true })
  expect(media.sizeBytes).toBeLessThanOrEqual(300_000)
  const jpeg = media.variants.find((variant: { name: string }) => variant.name === 'jpeg-1200')
  expect(jpeg).toMatchObject({ width: 1200, height: 630 })
  expect(jpeg.size).toBeLessThanOrEqual(300_000)
  expect(media.usages).toEqual([expect.objectContaining({ entityType: 'article', entityId: id, locale: 'pt-BR', context: 'og' })])

  await page.goto(`/blog/${copy.slug}`)
  const meta = (property: string) => page.locator(`meta[property="${property}"]`)
  await expect(meta('og:image')).toHaveAttribute('content', new RegExp(`/${jpeg.key.replaceAll('/', '\\/')}$`))
  await expect(meta('og:image:width')).toHaveAttribute('content', '1200')
  await expect(meta('og:image:height')).toHaveAttribute('content', '630')
  await expect(meta('og:image:alt')).toHaveAttribute('content', title)
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', new RegExp(`/${jpeg.key.replaceAll('/', '\\/')}$`))
})

test('the same title keeps its image, a new title makes another, and one chosen by hand stays', async ({ page }) => {
  const id = await openNew(page, `Reaproveitar ${uniqueName('og', 'x')}`)
  const request = page.context().request
  await publish(page, 'Publicar agora')
  const first = (await sourceOf(request, id)).ogImageMediaId

  // A new slug, the same title: the image stays
  const slug = page.getByRole('textbox', { name: 'Endereço (slug)' })
  await slug.fill(`${await slug.inputValue()}-v2`)
  await expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 10_000 })
  await publish(page, 'Publicar alterações')
  expect((await sourceOf(request, id)).ogImageMediaId).toBe(first)

  // A new title: a new image
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill(`Outro título ${uniqueName('og', 'x')}`)
  await expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 10_000 })
  await publish(page, 'Publicar alterações')
  const second = (await sourceOf(request, id)).ogImageMediaId
  expect(second).toBeTruthy()
  expect(second).not.toBe(first)

  // Chosen by hand: publishing keeps it
  const chosen = await readyImage(request, uniqueName('og-manual', 'jpg'))
  const copy = await sourceOf(request, id)
  expect((await request.patch(`/api/admin/articles/${id}`, { headers: ORIGIN, data: { version: copy.version, ogImageMediaId: chosen } })).status()).toBe(200)
  await page.reload()
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill(`Terceiro título ${uniqueName('og', 'x')}`)
  await expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 10_000 })
  await publish(page, 'Publicar alterações')
  expect((await sourceOf(request, id)).ogImageMediaId).toBe(chosen)
})

test('the preview draws the saved title, and the button replaces an image chosen by hand', async ({ page }) => {
  const id = await openNew(page, `Prévia ${uniqueName('og', 'x')}`)
  const request = page.context().request
  const chosen = await readyImage(request, uniqueName('og-manual', 'jpg'))
  const copy = await sourceOf(request, id)
  expect((await request.patch(`/api/admin/articles/${id}`, { headers: ORIGIN, data: { version: copy.version, ogImageMediaId: chosen } })).status()).toBe(200)
  await page.reload()

  await page.getByRole('button', { name: 'Ver prévia' }).click()
  const preview = page.getByTestId('og-preview')
  await expect(preview).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([1200, 630])
  await expectNoBlockingViolations(page)

  await page.getByRole('button', { name: 'Gerar e usar' }).click()
  await expect(page.getByTestId('og-status')).toHaveText('Imagem de compartilhamento gerada e definida.', { timeout: 90_000 })
  const generated = (await sourceOf(request, id)).ogImageMediaId
  expect(generated).not.toBe(chosen)
  // The editor follows it: the next save does not put the old image back
  await page.getByRole('textbox', { name: 'Resumo' }).fill('Um resumo novo')
  await expect(page.getByTestId('autosave-status')).toContainText(/Salvo às/, { timeout: 10_000 })
  expect((await sourceOf(request, id)).ogImageMediaId).toBe(generated)
})
