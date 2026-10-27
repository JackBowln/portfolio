// F01-T3: the vendored font files match shared/design/fonts.ts and ship with their licence; the tokens in main.css
// and the first-visit fallback CSS name the same families (ADR-0010 §4)
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { customProperties } from '../../shared/design/css-tokens'
import { fallbackFamilies, FONT_BASE_PATH, FONT_FAMILIES, FONT_LOADING_SCRIPT, FONT_PENDING_CSS, fontFaces, fontStack } from '../../shared/design/fonts'

const PUBLIC = 'public'
const onDisk = (src: string) => join(PUBLIC, src)

describe('vendored fonts', () => {
  it('every face points at a file that exists', () => {
    const missing = FONT_FAMILIES.flatMap(fontFaces).map(face => face.src).filter(src => !existsSync(onDisk(src)))
    expect(missing).toEqual([])
  })

  it('ships no file that is not referenced, and the OFL licence next to each family', () => {
    const referenced = new Set(FONT_FAMILIES.flatMap(fontFaces).map(face => onDisk(face.src)))
    for (const family of FONT_FAMILIES) {
      const dir = onDisk(`${FONT_BASE_PATH}/${family.slug}`)
      const files = readdirSync(dir)
      expect(files, family.name).toContain('OFL.txt')
      expect(files.filter(file => file !== 'OFL.txt').map(file => join(dir, file)).filter(file => !referenced.has(file)), family.name).toEqual([])
    }
  })

  it('latin covers the characters pt, es, de and fr need (œ, ß, ñ and friends)', () => {
    const latin = fontFaces(FONT_FAMILIES[0]!).find(face => face.subset === 'latin')!.unicodeRange
    const ranges = latin.split(',').map((range) => {
      const [start = '', end] = range.replace('U+', '').split('-')
      return [Number.parseInt(start, 16), Number.parseInt(end ?? start, 16)] as const
    })
    const covered = (char: string) => ranges.some(([start, end]) => char.codePointAt(0)! >= start && char.codePointAt(0)! <= end)
    expect([...'œŒßñÑçãõâêôàéèëïüöäÿ€«»—’'].filter(char => !covered(char))).toEqual([])
  })
})

describe('font tokens and first-visit loading', () => {
  const tokens = customProperties(readFileSync('app/assets/css/main.css', 'utf8'))

  it('main.css names each web font first, with the generic families of fonts.ts', () => {
    for (const family of FONT_FAMILIES) {
      expect(tokens.get(family.token), family.token).toBe(fontStack(family))
    }
  })

  it('while pending, the tokens name only the metric-matched fallbacks, never a web font', () => {
    for (const family of FONT_FAMILIES) {
      const value = new RegExp(`${family.token}:([^;}]+)`).exec(FONT_PENDING_CSS)?.[1] ?? ''
      expect(value.split(',').slice(0, family.fallbacks.length), family.token).toEqual(fallbackFamilies(family))
      expect(value).not.toContain(`"${family.name}",`)
    }
  })

  it('the loading script is static and holds the fonts only until load', () => {
    expect(FONT_LOADING_SCRIPT).toContain('addEventListener("load"')
    expect(FONT_LOADING_SCRIPT).not.toMatch(/\$\{|Date|Math\.random/)
  })
})
