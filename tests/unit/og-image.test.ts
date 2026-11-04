// F11-T2: the parts of the share image that decide, with a fake text measure (10 px per character): wrapping by word
// and by character, at most 3 lines with an ellipsis, the smaller size before truncating, the file name per title and
// the JPEG quality search under 300 KB; the 1200 px variant and the alt the site falls back to
import { describe, expect, it } from 'vitest'
import { targetWidths } from '../../shared/media/pipeline'
import { shareImage } from '../../shared/media/public'
import type { PublicImage } from '../../shared/media/public'
import { encodeWithin, layoutTitle, OG_MAX_BYTES, ogFileName, ogFilePrefix, OgTooLargeError, wrapLines } from '../../app/utils/admin/og-image'

const measure = (text: string) => Array.from(text).length * 10
const id = '01900000-0000-7000-8000-000000000000'
const input = { title: 'Um título', siteName: 'Portfólio', host: 'example.test' }

describe('wrapLines', () => {
  it('keeps a short title on one line', () => {
    expect(wrapLines('Olá mundo', 200, measure)).toEqual({ lines: ['Olá mundo'], truncated: false })
  })

  it('breaks by word and keeps the accents of the 5 locales', () => {
    const title = 'Ação über façade straße niño œuvre'
    expect(wrapLines(title, 140, measure)).toEqual({ lines: ['Ação über', 'façade straße', 'niño œuvre'], truncated: false })
  })

  it('breaks a word wider than a line by character', () => {
    const { lines } = wrapLines('Desenvolvimentoextraordinariamentelongo', 100, measure, 10)
    expect(lines.every(line => measure(line) <= 100)).toBe(true)
    expect(lines.join('')).toBe('Desenvolvimentoextraordinariamentelongo')
  })

  it('cuts after 3 lines with an ellipsis that fits, at a word boundary', () => {
    const { lines, truncated } = wrapLines('um dois três quatro cinco seis sete oito nove dez', 100, measure)
    expect(truncated).toBe(true)
    expect(lines).toEqual(['um dois', 'três', 'quatro…'])
    lines.forEach(line => expect(measure(line)).toBeLessThanOrEqual(100))
    // A last line without a usable space is cut inside the word
    expect(wrapLines('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 100, measure).lines).toEqual(['aaaaaaaaaa', 'aaaaaaaaaa', 'aaaaaaaaa…'])
  })

  it('composes decomposed accents before measuring, so a letter keeps its accent', () => {
    const decomposed = 'Ac\u0327a\u0303o'
    expect(wrapLines(decomposed, 1000, measure).lines).toEqual(['Ação'])
  })
})

describe('layoutTitle', () => {
  it('uses the larger size when the title fits in 3 lines, the smaller one otherwise', () => {
    // Width per character grows with the size: 76 px → 0.5 × size per character
    const at = (size: number) => (text: string) => Array.from(text).length * size * 0.5
    expect(layoutTitle('Curto', at).size).toBe(76)
    const long = 'palavra '.repeat(80).trim()
    const result = layoutTitle(long, at)
    expect(result.size).toBe(64)
    expect(result.truncated).toBe(true)
    expect(result.lines).toHaveLength(3)
  })
})

describe('ogFileName', () => {
  it('names the file after the item, the locale and what is drawn', async () => {
    const name = await ogFileName('article', id, 'de', input)
    expect(name).toMatch(new RegExp(`^${ogFilePrefix('article', id, 'de')}[0-9a-f]{16}\\.jpg$`))
    expect(await ogFileName('article', id, 'de', input)).toBe(name)
    expect(await ogFileName('article', id, 'de', { ...input, title: 'Outro título' })).not.toBe(name)
    expect(await ogFileName('article', id, 'de', { ...input, title: 'Um ti\u0301tulo' })).toBe(name)
    expect(await ogFileName('project', id, 'de', input)).not.toBe(name)
  })
})

describe('encodeWithin', () => {
  it('takes the highest quality that fits, and refuses when none does', async () => {
    const tried: number[] = []
    const blob = await encodeWithin(async (quality) => {
      tried.push(quality)
      return new Blob([new Uint8Array(quality > 0.8 ? OG_MAX_BYTES + 1 : 1000)])
    })
    expect(blob.size).toBe(1000)
    expect(tried).toEqual([0.9, 0.82, 0.74])
    await expect(encodeWithin(async () => new Blob([new Uint8Array(OG_MAX_BYTES + 1)]))).rejects.toBeInstanceOf(OgTooLargeError)
  })
})

describe('the delivered image', () => {
  it('ships a variant at the original 1200 px only when asked', () => {
    expect(targetWidths(1200)).toEqual([320, 640, 960])
    expect(targetWidths(1200, true)).toEqual([320, 640, 960, 1200])
    expect(targetWidths(1280, true)).toEqual([320, 640, 960, 1280])
  })

  it('takes the 1200 px JPEG and falls back to the title as alt', () => {
    const key = (format: string, width: number) => `media/ab/ab${'0'.repeat(62)}/${format}-${width}.${format === 'jpeg' ? 'jpg' : format}`
    const image: PublicImage = {
      width: 1200, height: 630, placeholderDataUrl: null, dominantColor: null, focalX: 0.5, focalY: 0.5, alt: '', decorative: true, caption: null, credit: null,
      variants: [960, 1200].flatMap(width => (['avif', 'jpeg'] as const).map(format => ({ format, width, height: Math.round(width * 630 / 1200), key: key(format, width) }))),
    }
    expect(shareImage(image, 'https://media.example.test', 'Título')).toEqual({ url: `https://media.example.test/${key('jpeg', 1200)}`, width: 1200, height: 630, alt: 'Título' })
    expect(shareImage({ ...image, alt: 'Própria' }, 'https://m.test', 'Título')?.alt).toBe('Própria')
  })
})
