// A reference article and project for the accessibility audit (F12-T2): a cover, a figure, a gallery and a code
// block with a Shiki-shaped HAST, published through the admin API with fixed slugs, once per run (the test data
// starts empty on every run, F12-T1). Workers that race to create them settle on the same items. The images are the
// real ones of tests/fixtures/reference-media (F11-T5): an image that does not decode lays out at its width attribute
// inside a grid, which is not what a visitor sees
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { ORIGIN } from './journeys'

export const REFERENCE = { article: 'artigo-a11y', project: 'projeto-a11y' } as const
const CODE = 'const answer = 42\nconsole.log(answer)'

function codeBlock() {
  const children: unknown[] = []
  CODE.split('\n').forEach((line, index) => {
    if (index > 0) {
      children.push({ type: 'text', value: '\n' })
    }
    children.push({ type: 'element', tagName: 'span', properties: { class: 'line' }, children: [{ type: 'element', tagName: 'span', properties: { style: '--shiki-light:#CF222E;--shiki-dark:#FF7B72' }, children: [{ type: 'text', value: line }] }] })
  })
  const hast = { type: 'element', tagName: 'pre', properties: { class: 'shiki shiki-themes github-light-default github-dark-default', style: '--shiki-light:#1f2328;--shiki-dark:#e6edf3;--shiki-light-bg:#ffffff;--shiki-dark-bg:#0d1117', tabindex: '0' }, children: [{ type: 'element', tagName: 'code', properties: {}, children }] }
  return { type: 'codeBlock', attrs: { id: 'c1', language: 'ts', code: CODE, hast } }
}

const body = (figure: string, gallery: string, withCode: boolean) => ({
  type: 'doc',
  attrs: { schemaVersion: 1 },
  content: [
    { type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: '[PLACEHOLDER] Abertura do conteúdo de referência da auditoria.' }] },
    { type: 'heading', attrs: { id: 'h1', level: 2 }, content: [{ type: 'text', text: '[PLACEHOLDER] Uma seção' }] },
    { type: 'image', attrs: { id: 'i1', mediaId: figure, caption: '[PLACEHOLDER] Legenda da figura' } },
    ...(withCode ? [codeBlock()] : []),
    { type: 'gallery', attrs: { id: 'g1', items: [figure, gallery], layout: 'grid' } },
    { type: 'paragraph', attrs: { id: 'p2' }, content: [{ type: 'text', text: '[PLACEHOLDER] Fim.' }] },
  ],
})

const MEDIA_DIR = 'tests/fixtures/reference-media'

/**
 * A ready image from the reference media: its variants as they are, and, as the original (never served, and the server
 * checks only its signature and size), its largest JPEG. Uploaded once per run; a second upload of the same hash gets
 * the existing item
 */
async function image(request: APIRequestContext, name: 'cover' | 'figure' | 'gallery', alt: string) {
  const { manifest } = JSON.parse(readFileSync(join(MEDIA_DIR, name, 'manifest.json'), 'utf8')) as { manifest: { variants: { format: string, width: number }[] } & Record<string, unknown> }
  const largest = Math.max(...manifest.variants.map(variant => variant.width))
  const original = readFileSync(join(MEDIA_DIR, name, `jpeg-${largest}.jpg`))
  const created = await request.post('/api/admin/media', { headers: ORIGIN, data: { ...manifest, size: original.byteLength } })
  if (created.status() === 409) {
    // Another worker is uploading it: wait until it is ready and has its alt
    const existing = /Already uploaded as media ([\w-]+)/.exec(await created.text())![1]!
    await expect.poll(async () => {
      const detail = await (await request.get(`/api/admin/media/${existing}`)).json() as { status: string, localizations: { locale: string, alt: string }[] }
      return detail.status === 'ready' && detail.localizations.some(item => item.locale === 'pt-BR' && item.alt !== '')
    }, { timeout: 30_000 }).toBe(true)
    return existing
  }
  expect(created.status(), await created.text()).toBe(201)
  const { id, uploads } = await created.json() as { id: string, uploads: { name: string, contentType: string }[] }
  for (const upload of uploads) {
    const extension = upload.name.startsWith('jpeg') || upload.name === 'original' ? 'jpg' : upload.name.split('-')[0]
    const bytes = upload.name === 'original' ? original : readFileSync(join(MEDIA_DIR, name, `${upload.name}.${extension}`))
    expect((await request.put(`/api/admin/media/${id}/variants/${upload.name}`, { headers: { ...ORIGIN, 'content-type': upload.contentType }, data: bytes })).status(), upload.name).toBe(200)
  }
  expect((await request.post(`/api/admin/media/${id}/finalize`, { headers: ORIGIN })).status()).toBe(200)
  expect((await request.patch(`/api/admin/media/${id}`, { headers: ORIGIN, data: { localizations: { 'pt-BR': { alt } } } })).status()).toBe(200)
  return id
}

async function exists(request: APIRequestContext, path: string) {
  return (await request.get(path)).status() === 200
}

/** Creates the reference article and project unless they are on the site; returns the article's id for previews */
export async function ensureReferenceContent(request: APIRequestContext): Promise<void> {
  expect((await request.post('/api/_test/session?role=owner', { headers: ORIGIN })).status()).toBe(200)
  const needArticle = !(await exists(request, `/api/public/blog/${REFERENCE.article}?locale=pt-BR`))
  const needProject = !(await exists(request, `/api/public/projects/${REFERENCE.project}?locale=pt-BR`))
  if (!needArticle && !needProject) {
    return
  }
  const [cover, figure, gallery] = [await image(request, 'cover', 'Capa de referência'), await image(request, 'figure', 'Figura de referência'), await image(request, 'gallery', 'Imagem da galeria de referência')]
  if (needArticle) {
    const created = await (await request.post('/api/admin/articles', { headers: ORIGIN, data: { title: 'Artigo de referência da auditoria [PLACEHOLDER]' } })).json() as { id: string }
    const saved = await request.patch(`/api/admin/articles/${created.id}`, { headers: ORIGIN, data: { version: 1, slug: REFERENCE.article, excerpt: '[PLACEHOLDER] Resumo.', coverMediaId: cover, body: body(figure, gallery, true) } })
    // Another worker took the slug first: theirs is the reference
    if (saved.status() === 200) {
      await expect.poll(async () => (await request.post(`/api/admin/articles/${created.id}/publish`, { headers: ORIGIN, data: { locale: 'pt-BR', version: 2 } })).status(), { timeout: 30_000 }).toBe(200)
    }
  }
  if (needProject) {
    const created = await (await request.post('/api/admin/projects', { headers: ORIGIN, data: { title: 'Projeto de referência da auditoria [PLACEHOLDER]' } })).json() as { id: string }
    const saved = await request.patch(`/api/admin/projects/${created.id}`, { headers: ORIGIN, data: { version: 1, slug: REFERENCE.project, summary: '[PLACEHOLDER] Resumo.', role: '[PLACEHOLDER] Papel', highlights: [{ label: '[PLACEHOLDER] Resultado', value: '42%' }], coverMediaId: cover, galleryMediaIds: [figure, gallery], body: body(figure, gallery, true) } })
    if (saved.status() === 200) {
      await expect.poll(async () => (await request.post(`/api/admin/projects/${created.id}/publish`, { headers: ORIGIN, data: { locale: 'pt-BR', version: 2 } })).status(), { timeout: 30_000 }).toBe(200)
    }
  }
  // The worker that took the slugs may still be publishing
  await expect.poll(() => exists(request, `/api/public/blog/${REFERENCE.article}?locale=pt-BR`), { timeout: 30_000 }).toBe(true)
  await expect.poll(() => exists(request, `/api/public/projects/${REFERENCE.project}?locale=pt-BR`), { timeout: 30_000 }).toBe(true)
}

/** A preview link of a fresh draft, for the preview template */
export async function previewLink(request: APIRequestContext): Promise<string> {
  const created = await (await request.post('/api/admin/articles', { headers: ORIGIN, data: { title: 'Rascunho em pré-visualização' } })).json() as { id: string }
  expect((await request.patch(`/api/admin/articles/${created.id}`, { headers: ORIGIN, data: { version: 1, excerpt: 'Resumo', body: body(await image(request, 'figure', 'Figura de referência'), await image(request, 'gallery', 'Imagem da galeria de referência'), true) } })).status()).toBe(200)
  const { url } = await (await request.post(`/api/admin/articles/${created.id}/preview-link`, { headers: ORIGIN, data: { hours: 1 } })).json() as { url: string }
  return new URL(url).pathname
}
