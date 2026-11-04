// Admin image pipeline (ADR-0007 §2), off the main thread: native decode (EXIF orientation applied, colors
// converted to sRGB), Lanczos3 resize, AVIF/WebP/JPEG encoding in WASM, ThumbHash placeholder and the SHA-256 of
// the stored original. Variants are encoded from pixels, so they carry no metadata; the original is stripped
// losslessly (JPEG, PNG, WebP) or, for AVIF, re-encoded. Codecs load only here, only when an upload starts
import encodeAvif from '@jsquash/avif/encode'
import encodeJpeg from '@jsquash/jpeg/encode'
import resize from '@jsquash/resize'
import encodeWebp from '@jsquash/webp/encode'
import { rgbaToThumbHash, thumbHashToAverageRGBA, thumbHashToRGBA } from 'thumbhash'
import { buildImageManifest, rgbToHex, stripImageMetadata, targetWidths, toHex, variantHeight } from '#shared/media/pipeline'
import { FORMAT_MIME_TYPES, IMAGE_FORMATS, IMAGE_MIME_TYPES, MEDIA_LIMITS } from '#shared/media/schemas'
import type { ImageFormat, ImageManifest } from '#shared/media/schemas'
import type { PipelineFile, PipelineMessage, PipelineRequest, PipelineStage } from '~/utils/admin/image-pipeline'

// Starting points from Squoosh's defaults; measured sizes and times are in the performance log (F04-T2)
const AVIF_OPTIONS = { quality: 50, speed: 6 }
const AVIF_ORIGINAL_OPTIONS = { quality: 80, speed: 6 }
const WEBP_OPTIONS = { quality: 80 }
const JPEG_OPTIONS = { quality: 78, progressive: true }
const PLACEHOLDER_MAX = 100

const scope = self as unknown as {
  postMessage: (message: PipelineMessage, transfer?: Transferable[]) => void
  onmessage: ((event: MessageEvent<PipelineRequest>) => void) | null
}

class PipelineError extends Error {
  constructor(readonly code: 'unsupported' | 'too_large', message: string) {
    super(message)
  }
}

function report(stage: PipelineStage, done: number, total: number) {
  scope.postMessage({ type: 'progress', stage, done, total })
}

async function decode(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    if (bitmap.width > MEDIA_LIMITS.maxDimension || bitmap.height > MEDIA_LIMITS.maxDimension) {
      throw new PipelineError('too_large', `Larger than ${MEDIA_LIMITS.maxDimension} px`)
    }
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true })
    if (!context) {
      throw new Error('No 2D context in the worker')
    }
    context.drawImage(bitmap, 0, 0)
    return context.getImageData(0, 0, bitmap.width, bitmap.height, { colorSpace: 'srgb' })
  }
  finally {
    bitmap.close()
  }
}

/** JPEG has no alpha: transparent pixels are composited over white instead of turning black */
function flattenOnWhite(image: ImageData): ImageData {
  const { data } = image
  let opaque = true
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] !== 255) {
      opaque = false
      break
    }
  }
  if (opaque) {
    return image
  }
  const out = new Uint8ClampedArray(data)
  for (let index = 0; index < out.length; index += 4) {
    const alpha = out[index + 3]! / 255
    out[index] = out[index]! * alpha + 255 * (1 - alpha)
    out[index + 1] = out[index + 1]! * alpha + 255 * (1 - alpha)
    out[index + 2] = out[index + 2]! * alpha + 255 * (1 - alpha)
    out[index + 3] = 255
  }
  return new ImageData(out, image.width, image.height)
}

function encode(format: ImageFormat, image: ImageData): Promise<ArrayBuffer> {
  switch (format) {
    case 'avif':
      return encodeAvif(image, AVIF_OPTIONS)
    case 'webp':
      return encodeWebp(image, WEBP_OPTIONS)
    case 'jpeg':
      return encodeJpeg(flattenOnWhite(image), JPEG_OPTIONS)
  }
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

/** ThumbHash of a ≤100 px thumbnail; the placeholder is its rendering as a tiny WebP data URL */
async function placeholder(image: ImageData) {
  const scale = Math.min(1, PLACEHOLDER_MAX / image.width, PLACEHOLDER_MAX / image.height)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const small = scale === 1 ? image : await resize(image, { width, height })
  const hash = rgbaToThumbHash(width, height, small.data)
  const rendered = thumbHashToRGBA(hash)
  const webp = await encodeWebp(new ImageData(new Uint8ClampedArray(rendered.rgba), rendered.w, rendered.h), { quality: 70 })
  return {
    placeholderDataUrl: `data:image/webp;base64,${base64(new Uint8Array(webp))}`,
    dominantColor: rgbToHex(thumbHashToAverageRGBA(hash)),
  }
}

async function process(file: File, withOriginalWidth: boolean) {
  const mimeType = file.type as ImageManifest['mimeType']
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new PipelineError('unsupported', `Unsupported type ${file.type || 'unknown'}`)
  }
  if (file.size > MEDIA_LIMITS.originalBytes) {
    throw new PipelineError('too_large', 'Original over 25 MB')
  }
  const timings: Record<PipelineStage, number> = { decode: 0, original: 0, variants: 0, placeholder: 0 }
  const timed = async <T>(stage: PipelineStage, task: () => Promise<T>): Promise<T> => {
    const start = performance.now()
    const result = await task()
    timings[stage] = Math.round(performance.now() - start)
    return result
  }

  report('decode', 0, 1)
  const image = await timed('decode', () => decode(file))
  report('decode', 1, 1)

  report('original', 0, 1)
  const original = await timed('original', async () => mimeType === 'image/avif'
    ? new Uint8Array(await encodeAvif(image, AVIF_ORIGINAL_OPTIONS))
    : stripImageMetadata(new Uint8Array(await file.arrayBuffer()), mimeType))
  if (original.byteLength > MEDIA_LIMITS.originalBytes) {
    throw new PipelineError('too_large', 'Original over 25 MB')
  }
  // A copy that owns exactly these bytes: it is hashed here and transferred to the page at the end
  const originalBuffer = original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength) as ArrayBuffer
  const sha256 = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', originalBuffer)))
  report('original', 1, 1)

  const widths = targetWidths(image.width, withOriginalWidth)
  const total = widths.length * IMAGE_FORMATS.length
  const files: PipelineFile[] = []
  const variants: ImageManifest['variants'] = []
  await timed('variants', async () => {
    for (const width of widths) {
      const height = variantHeight(width, image.width, image.height)
      const resized = width === image.width ? image : await resize(image, { width, height })
      for (const format of IMAGE_FORMATS) {
        const bytes = await encode(format, resized)
        if (bytes.byteLength > MEDIA_LIMITS.variantBytes) {
          throw new PipelineError('too_large', `${format}-${width} over 10 MB`)
        }
        files.push({ name: `${format}-${width}`, contentType: FORMAT_MIME_TYPES[format], bytes })
        variants.push({ format, width, height, size: bytes.byteLength })
        report('variants', files.length, total)
      }
    }
  })

  report('placeholder', 0, 1)
  const { placeholderDataUrl, dominantColor } = await timed('placeholder', () => placeholder(image))
  report('placeholder', 1, 1)

  files.unshift({ name: 'original', contentType: mimeType, bytes: originalBuffer })
  const manifest = buildImageManifest({
    mimeType,
    originalFilename: file.name,
    size: original.byteLength,
    width: image.width,
    height: image.height,
    sha256,
    placeholderDataUrl,
    dominantColor,
    variants,
  })
  scope.postMessage({ type: 'result', result: { manifest, files, timings } }, files.map(item => item.bytes))
}

scope.onmessage = (event) => {
  if (event.data.type !== 'process') {
    return
  }
  process(event.data.file, event.data.withOriginalWidth === true).catch((error: unknown) => {
    const code = error instanceof PipelineError ? error.code : 'failed'
    scope.postMessage({ type: 'error', code, message: error instanceof Error ? error.message.slice(0, 200) : 'Pipeline failed' })
  })
}
