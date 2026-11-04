// Admin-only. The share image of one localization (F11-T2): reads what to draw from the server, then keeps an image
// chosen by hand, keeps the one already made for this title, reuses a file made before for it, or draws a new one
// (Canvas → JPEG ≤ 300 KB → the image pipeline with a 1200 px variant → the media upload) and sets it on the
// localization. The answer carries the item with its new version when the image changed
import type { Locale } from '#shared/types/enums'
import { useImagePipeline } from '~/composables/admin/useImagePipeline'
import { useMediaUpload } from '~/composables/admin/useMediaUpload'
import { apiError } from '~/utils/admin/articles'
import type { OgContentType, OgInput } from '~/utils/admin/og-image'
import { drawOgImage, encodeWithin, OG_FONTS, OG_HEIGHT, OG_MAX_BYTES, OG_WIDTH, OgTooLargeError, ogFileName, ogFilePrefix } from '~/utils/admin/og-image'
import { adminFetch } from '~/utils/admin/session'

interface ShareImageState {
  locale: Locale
  title: string
  version: number
  siteName: string
  current: { mediaId: string, filename: string } | null
}

/** `manual`: an image chosen by hand stays · `current`: already made for this title · `reused` / `generated`: set now */
export type OgOutcome = 'manual' | 'current' | 'reused' | 'generated'

export interface OgTarget {
  type: OgContentType
  id: string
  locale: Locale
}

const apiBase = (target: OgTarget) => `/api/admin/${target.type}s/${encodeURIComponent(target.id)}`

/** Waits for the three fonts with the characters of this image, so the Canvas never draws with a fallback */
async function loadFonts(input: OgInput) {
  await Promise.all([
    document.fonts.load(OG_FONTS.title(76), input.title),
    document.fonts.load(OG_FONTS.label, input.siteName.toLocaleUpperCase('pt-BR')),
    document.fonts.load(OG_FONTS.host, input.host),
  ])
}

export async function renderOgImage(input: OgInput): Promise<Blob> {
  await loadFonts(input)
  const canvas = document.createElement('canvas')
  canvas.width = OG_WIDTH
  canvas.height = OG_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D unavailable')
  }
  drawOgImage(context, input)
  return encodeWithin(quality => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))), 'image/jpeg', quality)
  }))
}

export function useOgImage() {
  const pipeline = useImagePipeline()
  const uploader = useMediaUpload()
  const { siteUrl } = useRuntimeConfig().public
  const host = new URL(siteUrl).host

  async function inputOf(target: OgTarget) {
    const state = await adminFetch<ShareImageState>(`${apiBase(target)}/og-image`, { query: { locale: target.locale } })
    const input: OgInput = { title: state.title, siteName: state.siteName, host }
    return { state, input, filename: await ogFileName(target.type, target.id, target.locale, input) }
  }

  /** A ready image with exactly this file name, made before for the same title */
  async function existing(filename: string): Promise<string | undefined> {
    const { items } = await adminFetch<{ items: { id: string, originalFilename: string }[] }>('/api/admin/media', { query: { kind: 'image', status: 'ready', q: filename, limit: 5 } })
    return items.find(item => item.originalFilename === filename)?.id
  }

  async function upload(input: OgInput, filename: string): Promise<string> {
    const blob = await renderOgImage(input)
    const result = await pipeline.process(new File([blob], filename, { type: 'image/jpeg' }), { withOriginalWidth: true })
    const delivered = result.files.find(file => file.name === `jpeg-${OG_WIDTH}`)
    if (!delivered || delivered.bytes.byteLength > OG_MAX_BYTES) {
      throw new OgTooLargeError(`Delivered share image over ${OG_MAX_BYTES} bytes`)
    }
    let id: string
    try {
      id = await uploader.upload(result)
    }
    catch (error) {
      // The same bytes were uploaded before under another name (another item with the same title): that media serves
      const { status, issues } = apiError(error)
      const same = status === 409 ? /media (\S+)$/.exec(issues.find(issue => issue.path === 'sha256')?.message ?? '')?.[1] : undefined
      if (!same) {
        throw error
      }
      return same
    }
    // The image repeats the title, which og:image:alt carries: decorative, so it never asks for an alt text. Without
    // media:update it stays informative, and the site still takes the title as its alt
    await adminFetch(`/api/admin/media/${encodeURIComponent(id)}`, { method: 'PATCH', body: { decorative: true } }).catch(() => undefined)
    return id
  }

  /**
   * Makes sure the localization has its share image. `replace` (the button) also replaces one chosen by hand; on
   * publish it stays. Resolves with the item when the image changed
   */
  async function ensure<D = unknown>(target: OgTarget, options: { replace?: boolean } = {}): Promise<{ outcome: OgOutcome, detail?: D }> {
    const { state, input, filename } = await inputOf(target)
    const current = state.current
    if (current?.filename === filename) {
      return { outcome: 'current' }
    }
    if (current && !current.filename.startsWith(ogFilePrefix(target.type, target.id, target.locale)) && !options.replace) {
      return { outcome: 'manual' }
    }
    const found = await existing(filename)
    const mediaId = found ?? await upload(input, filename)
    const detail = await adminFetch<D>(`${apiBase(target)}/og-image`, { method: 'PUT', body: { locale: target.locale, version: state.version, mediaId } }) as D
    return { outcome: found ? 'reused' : 'generated', detail }
  }

  /** The image as it would be drawn now, for the preview */
  async function preview(target: OgTarget): Promise<Blob> {
    const { input } = await inputOf(target)
    return renderOgImage(input)
  }

  return { ensure, preview, progress: pipeline.progress }
}
