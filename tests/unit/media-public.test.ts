// F04-T3: only delivered objects become public URLs, and a page gets the text of its locale (ADR-0007 §5)
import { describe, expect, it } from 'vitest'
import { isPublicMediaKey, mediaUrl, toPublicImage } from '../../shared/media/public'

const SHA = 'ab'.repeat(32)

describe('public media keys', () => {
  it('accepts variants, the video file and tracks under their own hash', () => {
    for (const name of ['avif-320.avif', 'webp-2560.webp', 'jpeg-640.jpg', 'video.mp4', 'video.webm', 'captions-pt-BR.vtt', 'subtitles-de.vtt']) {
      expect(isPublicMediaKey(`media/ab/${SHA}/${name}`), name).toBe(true)
    }
  })

  it('refuses originals, other prefixes, traversal, encoded slashes and unknown names', () => {
    for (const value of [
      `originals/${SHA}.jpg`,
      `media/cd/${SHA}/avif-320.avif`,
      `media/ab/${SHA}/../../originals/${SHA}.jpg`,
      `media/ab/${SHA}/avif-320.avif%2F..`,
      `media/ab/${SHA}/original.jpg`,
      `media/ab/${SHA}/avif-320.svg`,
      `media/ab/${SHA.toUpperCase()}/avif-320.avif`,
      `media/ab/${SHA}/captions-pt-br.vtt`,
    ]) {
      expect(isPublicMediaKey(value), value).toBe(false)
    }
  })

  it('joins base and key without doubling slashes', () => {
    expect(mediaUrl('https://media.example/', `media/ab/${SHA}/video.mp4`)).toBe(`https://media.example/media/ab/${SHA}/video.mp4`)
    expect(mediaUrl('https://media.example', `originals/${SHA}.jpg`)).toBeUndefined()
  })
})

describe('toPublicImage', () => {
  const record = { width: 100, height: 50, variants: [], placeholderDataUrl: null, dominantColor: null, focalX: 0.5, focalY: 0.5, decorative: false }
  const localizations = [
    { locale: 'pt-BR' as const, alt: 'Foto', caption: 'Legenda', credit: null },
    { locale: 'de' as const, alt: 'Bild', caption: null, credit: 'Foto: X' },
    { locale: 'fr' as const, alt: '', caption: null, credit: null },
  ]

  it('uses the locale text, falling back to pt-BR when the locale has no alt', () => {
    expect(toPublicImage(record, localizations, 'de')).toMatchObject({ alt: 'Bild', credit: 'Foto: X' })
    expect(toPublicImage(record, localizations, 'fr')).toMatchObject({ alt: 'Foto', caption: 'Legenda' })
    expect(toPublicImage(record, [], 'en').alt).toBe('')
  })

  it('never gives a decorative image an alt', () => {
    expect(toPublicImage({ ...record, decorative: true }, localizations, 'de').alt).toBe('')
  })
})
