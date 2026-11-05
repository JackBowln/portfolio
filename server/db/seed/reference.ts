// The reference content Lighthouse measures (F11-T5, performance-budgets §1): an article in the five locales and a
// project, both with a cover, a figure, a gallery and, in the article, highlighted code; the media from
// tests/fixtures/reference-media (real images from the pipeline's codecs). Everything is [PLACEHOLDER]. Idempotent:
// what is already published is kept. Used by the production-like seed (prodlike.ts); never by the deployed Worker
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DocumentJson } from '../../../shared/content/document-schema.ts'
import { expectedUploads } from '../../../shared/media/keys.ts'
import type { ImageManifest } from '../../../shared/media/schemas.ts'
import { LOCALES, SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Db } from '../client.ts'
import { mediaLocalizations } from '../schema/media.ts'
import { createArticle, getArticle, updateArticle } from '../../services/content/articles.service.ts'
import { findPublishedArticle, findTopic } from '../../services/content/blog.repo.ts'
import { createLocalization } from '../../services/content/localized.repo.ts'
import { findPublishedProject, findTechnology } from '../../services/content/projects-public.repo.ts'
import { createProject, publishProject, updateProject } from '../../services/content/projects.service.ts'
import { publishArticle } from '../../services/content/publishing.service.ts'
import { findMediaIdBySha256, insertMedia, markReady } from '../../services/media/media.repo.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'

const MEDIA_DIR = join(import.meta.dirname, '../../../tests/fixtures/reference-media')
export const REFERENCE_SLUGS = { article: 'artigo-de-referencia', project: 'projeto-de-referencia' } as const

type ReferenceMedia = 'cover' | 'figure' | 'gallery'

/** The media row and its delivered files in R2, once per image (content addressed, like an upload) */
async function ensureMedia(db: Db, bucket: R2Bucket, userId: string, name: ReferenceMedia): Promise<string> {
  const { alt, manifest } = JSON.parse(readFileSync(join(MEDIA_DIR, name, 'manifest.json'), 'utf8')) as { alt: string, manifest: ImageManifest }
  const existing = await findMediaIdBySha256(db, manifest.sha256)
  if (existing) {
    return existing
  }
  const uploads = expectedUploads({ kind: 'image', sha256: manifest.sha256, mimeType: manifest.mimeType, sizeBytes: manifest.size, variants: manifest.variants, tracks: [] })
  const variants = manifest.variants.map(variant => ({ ...variant, name: `${variant.format}-${variant.width}`, key: uploads.find(upload => upload.name === `${variant.format}-${variant.width}`)!.key }))
  for (const variant of variants) {
    const file = readFileSync(join(MEDIA_DIR, name, variant.key.split('/').at(-1)!))
    await bucket.put(variant.key, file, { httpMetadata: { contentType: uploads.find(upload => upload.key === variant.key)!.contentType, cacheControl: 'public, max-age=31536000, immutable' } })
  }
  const id = uuidv7()
  await insertMedia(db, {
    id,
    kind: 'image',
    mimeType: manifest.mimeType,
    originalFilename: manifest.originalFilename,
    sizeBytes: manifest.size,
    width: manifest.width,
    height: manifest.height,
    sha256: manifest.sha256,
    // The original is never served, so the seed does not store it
    originalKey: uploads.find(upload => upload.name === 'original')!.key,
    variants,
    placeholderDataUrl: manifest.placeholderDataUrl,
    dominantColor: manifest.dominantColor,
    createdBy: userId,
  }, [])
  await markReady(db, id)
  await db.insert(mediaLocalizations).values({ mediaId: id, locale: SOURCE_LOCALE, alt, translationState: 'source' })
  return id
}

const CODE = 'export function sum(a: number, b: number) {\n  return a + b\n}'

/** A code block with a HAST shaped like Shiki's (two themes, one span per token) */
function codeBlock(id: string) {
  const lines = CODE.split('\n')
  const children: unknown[] = []
  lines.forEach((line, index) => {
    if (index > 0) {
      children.push({ type: 'text', value: '\n' })
    }
    children.push({ type: 'element', tagName: 'span', properties: { class: 'line' }, children: [{ type: 'element', tagName: 'span', properties: { style: '--shiki-light:#CF222E;--shiki-dark:#FF7B72' }, children: [{ type: 'text', value: line }] }] })
  })
  const hast = {
    type: 'element',
    tagName: 'pre',
    properties: { class: 'shiki shiki-themes github-light-default github-dark-default', style: '--shiki-light:#1f2328;--shiki-dark:#e6edf3;--shiki-light-bg:#ffffff;--shiki-dark-bg:#0d1117', tabindex: '0' },
    children: [{ type: 'element', tagName: 'code', properties: {}, children }],
  }
  return { type: 'codeBlock' as const, attrs: { id, language: 'typescript', code: CODE, hast } }
}

const paragraph = (id: string, text: string) => ({ type: 'paragraph' as const, attrs: { id }, content: [{ type: 'text' as const, text }] })
const heading = (id: string, text: string) => ({ type: 'heading' as const, attrs: { id, level: 2 as const }, content: [{ type: 'text' as const, text }] })

function referenceBody(media: Record<ReferenceMedia, string>, withCode: boolean): DocumentJson {
  return {
    type: 'doc',
    attrs: { schemaVersion: 1 },
    content: [
      paragraph('p1', '[PLACEHOLDER] Um parágrafo de abertura com algumas frases, do tamanho de uma introdução de verdade, para medir a leitura com texto, imagens e código.'),
      heading('h1', '[PLACEHOLDER] Primeira seção'),
      paragraph('p2', '[PLACEHOLDER] Texto da primeira seção, antes da figura.'),
      { type: 'image', attrs: { id: 'i1', mediaId: media.figure, caption: '[PLACEHOLDER] Legenda da figura' } },
      ...(withCode ? [codeBlock('c1')] : []),
      heading('h2', '[PLACEHOLDER] Segunda seção'),
      paragraph('p3', '[PLACEHOLDER] Texto da segunda seção, antes da galeria.'),
      { type: 'gallery', attrs: { id: 'g1', items: [media.figure, media.gallery], layout: 'grid' } },
      paragraph('p4', '[PLACEHOLDER] Fim.'),
    ],
  } as DocumentJson
}

export async function ensureReferenceContent(db: Db, bucket: R2Bucket, userId: string): Promise<void> {
  const actor = { userId, ip: null, ipHashSalt: undefined }
  const media = {
    cover: await ensureMedia(db, bucket, userId, 'cover'),
    figure: await ensureMedia(db, bucket, userId, 'figure'),
    gallery: await ensureMedia(db, bucket, userId, 'gallery'),
  }

  if (!(await findPublishedArticle(db, SOURCE_LOCALE, REFERENCE_SLUGS.article))) {
    const topicId = (await findTopic(db, SOURCE_LOCALE, 'x'))?.id
    const body = referenceBody(media, true)
    const article = await createArticle(db, userId, REFERENCE_SLUGS.article)
    const saved = await updateArticle(db, userId, article, { version: 1, title: 'Artigo de referência [PLACEHOLDER]', slug: REFERENCE_SLUGS.article, excerpt: '[PLACEHOLDER] Resumo do artigo de referência.', body, coverMediaId: media.cover, ...(topicId ? { tagIds: [topicId] } : {}) })
    await publishArticle(db, actor, saved, SOURCE_LOCALE, 2)
    for (const locale of LOCALES.filter(code => code !== SOURCE_LOCALE)) {
      await createLocalization(db, 'article', { articleId: article.id, locale, title: `Reference article (${locale}) [PLACEHOLDER]`, slug: REFERENCE_SLUGS.article, excerpt: '[PLACEHOLDER]', body, translationState: 'approved' }, { coverMediaId: media.cover, tagIds: topicId ? [topicId] : [] })
      await publishArticle(db, actor, await getArticle(db, article.id), locale, 1)
    }
  }

  if (!(await findPublishedProject(db, SOURCE_LOCALE, REFERENCE_SLUGS.project))) {
    const technologyId = (await findTechnology(db, SOURCE_LOCALE, 'tecnologia-x'))?.id
    const project = await createProject(db, userId, REFERENCE_SLUGS.project)
    const saved = await updateProject(db, userId, project, {
      version: 1,
      title: 'Projeto de referência [PLACEHOLDER]',
      slug: REFERENCE_SLUGS.project,
      summary: '[PLACEHOLDER] Resumo do projeto de referência.',
      role: '[PLACEHOLDER] Papel',
      highlights: [{ label: '[PLACEHOLDER] Resultado', value: '[PLACEHOLDER]' }],
      body: referenceBody(media, false),
      coverMediaId: media.cover,
      galleryMediaIds: [media.figure, media.gallery],
      ...(technologyId ? { technologyIds: [technologyId] } : {}),
      periodStart: '2024-01',
      periodEnd: '2024-06',
    })
    await publishProject(db, actor, saved, SOURCE_LOCALE, 2)
  }
}
