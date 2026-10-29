// F04-T3: the markup of <ResponsiveImage> and <MediaVideo> (ADR-0007 §4, §6): modern sources with srcset/sizes,
// explicit dimensions, alt, lazy by default and priority only when asked; video without autoplay or preload
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { PublicImage, PublicVideo } from '#shared/media/public'
import MediaVideo from '~/components/media/MediaVideo.vue'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'

const SHA = 'ab'.repeat(32)
const BASE = 'http://localhost:3000'
const key = (name: string) => `media/ab/${SHA}/${name}`

const image: PublicImage = {
  width: 1400,
  height: 1050,
  variants: (['avif', 'webp', 'jpeg'] as const).flatMap(format => [640, 320, 1280, 960].map(width => ({
    format,
    width,
    height: width * 0.75,
    key: key(`${format}-${width}.${format === 'jpeg' ? 'jpg' : format}`),
  }))),
  placeholderDataUrl: 'data:image/webp;base64,UklGRg==',
  dominantColor: '#1a2b3c',
  focalX: 0.25,
  focalY: 0.8,
  alt: 'Praia ao pôr do sol',
  decorative: false,
  caption: null,
  credit: null,
}

describe('ResponsiveImage', () => {
  it('offers AVIF and WebP before a JPEG img, each with a sorted srcset and the given sizes', async () => {
    const wrapper = await mountSuspended(ResponsiveImage, { props: { image, sizes: '(min-width: 64rem) 50vw, 100vw' } })
    const sources = wrapper.findAll('picture > source')
    expect(sources.map(source => source.attributes('type'))).toEqual(['image/avif', 'image/webp'])
    expect(sources[0]!.attributes('srcset')).toBe([320, 640, 960, 1280].map(width => `${BASE}/${key(`avif-${width}.avif`)} ${width}w`).join(', '))
    for (const element of [...sources, wrapper.get('img')]) {
      expect(element.attributes('sizes')).toBe('(min-width: 64rem) 50vw, 100vw')
    }
    const img = wrapper.get('img')
    expect(img.attributes('srcset')).toContain(`${BASE}/${key('jpeg-320.jpg')} 320w`)
    expect(img.attributes('src')).toBe(`${BASE}/${key('jpeg-1280.jpg')}`)
  })

  it('always has dimensions, alt, focal point and placeholder, and is lazy without fetchpriority by default', async () => {
    const img = (await mountSuspended(ResponsiveImage, { props: { image, sizes: '100vw' } })).get('img')
    expect(img.attributes()).toMatchObject({ width: '1400', height: '1050', alt: 'Praia ao pôr do sol', loading: 'lazy', decoding: 'async' })
    expect(img.attributes('fetchpriority')).toBeUndefined()
    const style = img.attributes('style') ?? ''
    expect(style).toContain('object-position: 25% 80%')
    expect(style).toContain('background-color: #1a2b3c')
    expect(style).toContain('data:image/webp;base64,UklGRg==')
  })

  it('loads eagerly with high priority only as the LCP image', async () => {
    const img = (await mountSuspended(ResponsiveImage, { props: { image, sizes: '100vw', priority: true } })).get('img')
    expect(img.attributes('loading')).toBe('eager')
    expect(img.attributes('fetchpriority')).toBe('high')
  })

  it('has an empty alt only when decorative, and never links a key that is not a delivered file', async () => {
    const decorative = (await mountSuspended(ResponsiveImage, { props: { image: { ...image, decorative: true }, sizes: '100vw' } })).get('img')
    expect(decorative.attributes('alt')).toBe('')

    const tampered = { ...image, variants: [{ format: 'jpeg' as const, width: 320, height: 240, key: `originals/${SHA}.jpg` }, ...image.variants.filter(variant => variant.format !== 'jpeg')] }
    const img = (await mountSuspended(ResponsiveImage, { props: { image: tampered, sizes: '100vw' } })).get('img')
    expect(img.attributes('srcset') ?? '').toBe('')
    expect(img.attributes('src')).toBeUndefined()
  })
})

describe('MediaVideo', () => {
  const video: PublicVideo = {
    width: 1280,
    height: 720,
    key: key('video.mp4'),
    mimeType: 'video/mp4',
    durationMs: 12_000,
    poster: image,
    tracks: [
      { locale: 'de', kind: 'captions', label: 'Deutsch', key: key('captions-de.vtt') },
      { locale: 'pt-BR', kind: 'subtitles', label: 'Português (legendas)', key: key('subtitles-pt-BR.vtt') },
      { locale: 'pt-BR', kind: 'captions', label: 'Português', key: key('captions-pt-BR.vtt') },
    ],
  }

  it('never autoplays or preloads, keeps its size and uses a poster', async () => {
    const element = (await mountSuspended(MediaVideo, { props: { video } })).get('video')
    expect(element.attributes()).toMatchObject({ preload: 'none', width: '1280', height: '720', poster: `${BASE}/${key('jpeg-1280.jpg')}` })
    expect(element.attributes('controls')).toBeDefined()
    expect(element.attributes('autoplay')).toBeUndefined()
    expect(element.get('source').attributes()).toMatchObject({ src: `${BASE}/${key('video.mp4')}`, type: 'video/mp4' })
  })

  it('lists one track per locale, with the current locale captions on by default', async () => {
    const tracks = (await mountSuspended(MediaVideo, { props: { video } })).findAll('track')
    expect(tracks.map(track => [track.attributes('srclang'), track.attributes('kind'), track.attributes('label')])).toEqual([
      ['de', 'captions', 'Deutsch'],
      ['pt-BR', 'subtitles', 'Português (legendas)'],
      ['pt-BR', 'captions', 'Português'],
    ])
    expect(tracks.map(track => track.attributes('default') !== undefined)).toEqual([false, false, true])
  })
})
