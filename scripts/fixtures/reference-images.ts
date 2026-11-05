// node scripts/fixtures/reference-images.ts — regenerates tests/fixtures/reference-media (F11-T5). Abstract images
// (gradients, soft shapes and a little grain, no real content) put through the same steps and codec settings as the
// admin pipeline (app/workers/admin/image-pipeline.worker.ts): Lanczos3 resize, AVIF/WebP/JPEG per width, ThumbHash
// placeholder, SHA-256 of the original (only the variants are written: originals are never served). The seed of the production-like instance (server/db/seed/prodlike.ts) reads
// the result, so Lighthouse measures the reference article and project with real images. Deterministic per name
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import encodeAvif, { init as initAvif } from '@jsquash/avif/encode.js'
import encodeJpeg, { init as initJpeg } from '@jsquash/jpeg/encode.js'
import resize, { initResize } from '@jsquash/resize'
import encodeWebp, { init as initWebp } from '@jsquash/webp/encode.js'
import { rgbaToThumbHash, thumbHashToAverageRGBA, thumbHashToRGBA } from 'thumbhash'
import { buildImageManifest, rgbToHex, targetWidths, toHex, variantHeight } from '../../shared/media/pipeline.ts'
import { IMAGE_FORMATS, MIME_EXTENSIONS, FORMAT_MIME_TYPES } from '../../shared/media/schemas.ts'
import type { ImageFormat, ImageManifest } from '../../shared/media/schemas.ts'

// Node has no ImageData; the codecs only read these three fields
class NodeImageData {
  readonly colorSpace = 'srgb'
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data
    this.width = width
    this.height = height
  }
}
;(globalThis as { ImageData?: unknown }).ImageData ??= NodeImageData

const CODECS = join(import.meta.dirname, '../../node_modules/@jsquash')
const OUT = join(import.meta.dirname, '../../tests/fixtures/reference-media')
const OPTIONS = { avif: { quality: 50, speed: 6 }, webp: { quality: 80 }, jpeg: { quality: 78, progressive: true } } as const

export interface ReferenceImage {
  name: string
  width: number
  height: number
  /** pt-BR alt, [PLACEHOLDER] like the rest of the reference content */
  alt: string
  /** Two colors of the gradient and the shapes, as RGB */
  colors: [[number, number, number], [number, number, number]]
}

export const REFERENCE_IMAGES: ReferenceImage[] = [
  { name: 'cover', width: 1600, height: 900, alt: '[PLACEHOLDER] Capa abstrata em azul e rosa', colors: [[18, 28, 52], [214, 120, 160]] },
  { name: 'figure', width: 1280, height: 720, alt: '[PLACEHOLDER] Diagrama abstrato em verde', colors: [[24, 60, 48], [190, 220, 170]] },
  { name: 'gallery', width: 1280, height: 960, alt: '[PLACEHOLDER] Composição abstrata em âmbar', colors: [[70, 40, 20], [240, 200, 120]] },
]

/** A small seeded random generator, so the same name always gives the same bytes */
function random(seed: string) {
  let state = [...seed].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0
    return ((state ^= state >>> 16) >>> 0) / 4294967296
  }
}

function paint(image: ReferenceImage): ImageData {
  const { width, height, colors: [from, to] } = image
  const next = random(image.name)
  const circles = Array.from({ length: 6 }, () => ({ x: next() * width, y: next() * height, r: (0.1 + next() * 0.25) * Math.min(width, height), mix: next() }))
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let t = (x / width) * 0.6 + (y / height) * 0.4
      for (const circle of circles) {
        const d = Math.hypot(x - circle.x, y - circle.y) / circle.r
        if (d < 1) {
          t = t * d + circle.mix * (1 - d)
        }
      }
      const grain = (next() - 0.5) * 4
      const index = (y * width + x) * 4
      for (let channel = 0; channel < 3; channel++) {
        data[index + channel] = from[channel]! + (to[channel]! - from[channel]!) * t + grain
      }
      data[index + 3] = 255
    }
  }
  return new ImageData(data, width, height)
}

function encode(format: ImageFormat, image: ImageData): Promise<ArrayBuffer> {
  return format === 'avif' ? encodeAvif(image, OPTIONS.avif) : format === 'webp' ? encodeWebp(image, OPTIONS.webp) : encodeJpeg(image, OPTIONS.jpeg)
}

async function placeholder(image: ImageData) {
  const scale = Math.min(1, 100 / image.width, 100 / image.height)
  const small = await resize(image, { width: Math.round(image.width * scale), height: Math.round(image.height * scale) })
  const hash = rgbaToThumbHash(small.width, small.height, small.data)
  const rendered = thumbHashToRGBA(hash)
  const webp = await encodeWebp(new ImageData(new Uint8ClampedArray(rendered.rgba), rendered.w, rendered.h), { quality: 70 })
  return { placeholderDataUrl: `data:image/webp;base64,${Buffer.from(webp).toString('base64')}`, dominantColor: rgbToHex(thumbHashToAverageRGBA(hash)) }
}

async function generate(image: ReferenceImage) {
  const pixels = paint(image)
  const original = new Uint8Array(await encodeJpeg(pixels, { quality: 90 }))
  const sha256 = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', original)))
  const dir = join(OUT, image.name)
  mkdirSync(dir, { recursive: true })
  // The original is never served (ADR-0007), so only its hash and size are kept, not the file
  const variants: ImageManifest['variants'] = []
  for (const width of targetWidths(image.width)) {
    const height = variantHeight(width, image.width, image.height)
    const resized = width === image.width ? pixels : await resize(pixels, { width, height })
    for (const format of IMAGE_FORMATS) {
      const bytes = new Uint8Array(await encode(format, resized))
      writeFileSync(join(dir, `${format}-${width}.${MIME_EXTENSIONS[FORMAT_MIME_TYPES[format]]}`), bytes)
      variants.push({ format, width, height, size: bytes.byteLength })
    }
  }
  const manifest = buildImageManifest({ mimeType: 'image/jpeg', originalFilename: `referencia-${image.name}.jpg`, size: original.byteLength, width: image.width, height: image.height, sha256, ...await placeholder(pixels), variants })
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify({ alt: image.alt, manifest }, null, 2)}\n`)
  return variants.reduce((sum, variant) => sum + variant.size, 0)
}

await initAvif({ wasmBinary: readFileSync(join(CODECS, 'avif/codec/enc/avif_enc.wasm')) } as never)
await initJpeg({ wasmBinary: readFileSync(join(CODECS, 'jpeg/codec/enc/mozjpeg_enc.wasm')) } as never)
await initWebp({ wasmBinary: readFileSync(join(CODECS, 'webp/codec/enc/webp_enc.wasm')) } as never)
await initResize(await WebAssembly.compile(readFileSync(join(CODECS, 'resize/lib/resize/pkg/squoosh_resize_bg.wasm'))))
rmSync(OUT, { recursive: true, force: true })
let total = 0
for (const image of REFERENCE_IMAGES) {
  total += await generate(image)
}
console.log(`reference-media: ${REFERENCE_IMAGES.length} images, ${(total / 1000).toFixed(1)} kB`)
