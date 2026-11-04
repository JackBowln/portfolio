// Admin-only. The share image template (F11-T2): 1200 × 630 on a Canvas in the browser, since nothing is rendered
// on the server (ADR-0007). The dark theme of the visual direction: night background, rose hairline and label, the
// title in Fraunces up to 3 lines with an ellipsis, the site's name in JetBrains Mono and its host in Inter. The parts
// that decide (wrapping, the name of the file, the quality search) are pure and unit-tested
import type { Locale } from '#shared/types/enums'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630
/** Largest file accepted, original and delivered JPEG alike */
export const OG_MAX_BYTES = 300_000
export const OG_MAX_LINES = 3
/** Bump when the drawing changes, so every image is generated again on the next publish */
export const OG_TEMPLATE_VERSION = 1

// The tokens of main.css (night-950, rose-300, paper-200, night-300); Canvas takes OKLCH like CSS
const COLORS = { bg: 'oklch(0.16 0.03 250)', accent: 'oklch(0.81 0.115 355)', text: 'oklch(0.94 0.012 75)', muted: 'oklch(0.74 0.025 240)' }
const PADDING = 80
const TITLE_SIZES = [76, 64] as const
const LINE_HEIGHT = 1.12
export const OG_FONTS = {
  title: (size: number) => `600 ${size}px Fraunces`,
  label: '600 24px "JetBrains Mono"',
  host: '400 28px Inter',
} as const

export type OgContentType = 'article' | 'project'

export interface OgInput {
  title: string
  siteName: string
  /** The site's host, shown at the bottom */
  host: string
}

/** Every generated image of one item and locale starts like this; anything else was chosen by hand */
export const ogFilePrefix = (type: OgContentType, id: string, locale: Locale) => `og-${type}-${id}-${locale}-`

/** og-<type>-<id>-<locale>-<hash>.jpg, the hash of what is drawn: the same title gives the same name */
export async function ogFileName(type: OgContentType, id: string, locale: Locale, input: OgInput): Promise<string> {
  const text = JSON.stringify([OG_TEMPLATE_VERSION, input.title.normalize('NFC'), input.siteName, input.host])
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  const hash = [...digest.slice(0, 8)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${ogFilePrefix(type, id, locale)}${hash}.jpg`
}

/** The longest start of `chars` that fits, at least one character so the loop always advances */
function fitting(chars: string[], fits: (text: string) => boolean): number {
  let count = 1
  while (count < chars.length && fits(chars.slice(0, count + 1).join(''))) {
    count++
  }
  return count
}

/**
 * Lines of `text` up to `maxWidth`, by word; a word wider than a line breaks by character. Past `maxLines`, the last
 * line ends with an ellipsis that fits. Characters are code points of the NFC text, so a letter and its accent stay
 * together
 */
export function wrapLines(text: string, maxWidth: number, measure: (text: string) => number, maxLines = OG_MAX_LINES): { lines: string[], truncated: boolean } {
  const fits = (value: string) => measure(value) <= maxWidth
  const lines: string[] = []
  let current = ''
  for (const word of text.normalize('NFC').trim().split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (fits(candidate)) {
      current = candidate
      continue
    }
    if (current) {
      lines.push(current)
    }
    let chars = Array.from(word)
    while (!fits(chars.join('')) && chars.length > 1) {
      const count = fitting(chars, fits)
      lines.push(chars.slice(0, count).join(''))
      chars = chars.slice(count)
    }
    current = chars.join('')
  }
  if (current) {
    lines.push(current)
  }
  if (lines.length <= maxLines) {
    return { lines, truncated: false }
  }
  const kept = lines.slice(0, maxLines)
  const full = Array.from(`${kept[maxLines - 1]} ${lines[maxLines]}`)
  let last = full
  while (last.length > 0 && !fits(`${last.join('').trimEnd()}…`)) {
    last = last.slice(0, -1)
  }
  // Cut at the last space rather than inside a word, unless that leaves less than half the line
  const space = last.lastIndexOf(' ')
  if (full[last.length] !== ' ' && space >= last.length / 2) {
    last = last.slice(0, space)
  }
  kept[maxLines - 1] = `${last.join('').replace(/[\s,.;:!?–—-]+$/u, '')}…`
  return { lines: kept, truncated: true }
}

/** The title's lines and size: the larger size when it fits in 3 lines, else the smaller one, truncated if needed */
export function layoutTitle(title: string, measureAt: (size: number) => (text: string) => number) {
  const maxWidth = OG_WIDTH - PADDING * 2
  for (const size of TITLE_SIZES) {
    const wrapped = wrapLines(title, maxWidth, measureAt(size))
    if (!wrapped.truncated || size === TITLE_SIZES[TITLE_SIZES.length - 1]) {
      return { size, ...wrapped }
    }
  }
  throw new Error('unreachable')
}

export function drawOgImage(context: CanvasRenderingContext2D, input: OgInput): void {
  context.fillStyle = COLORS.bg
  context.fillRect(0, 0, OG_WIDTH, OG_HEIGHT)
  context.textBaseline = 'alphabetic'
  context.textAlign = 'start'

  // The accent: a hairline and the site's name above the title
  context.fillStyle = COLORS.accent
  context.fillRect(PADDING, PADDING, 96, 3)
  context.font = OG_FONTS.label
  if ('letterSpacing' in context) {
    context.letterSpacing = '0.12em'
  }
  context.fillText(input.siteName.toLocaleUpperCase('pt-BR'), PADDING, PADDING + 56)
  if ('letterSpacing' in context) {
    context.letterSpacing = '0px'
  }

  const { size, lines } = layoutTitle(input.title, (fontSize) => {
    context.font = OG_FONTS.title(fontSize)
    return value => context.measureText(value).width
  })
  context.font = OG_FONTS.title(size)
  context.fillStyle = COLORS.text
  const lineHeight = Math.round(size * LINE_HEIGHT)
  lines.forEach((line, index) => context.fillText(line, PADDING, PADDING + 150 + size + index * lineHeight))

  context.font = OG_FONTS.host
  context.fillStyle = COLORS.muted
  context.fillText(input.host, PADDING, OG_HEIGHT - PADDING)
}

export class OgTooLargeError extends Error {}

/** The best JPEG quality whose file fits `maxBytes`, from high to low */
export async function encodeWithin(encode: (quality: number) => Promise<Blob>, maxBytes = OG_MAX_BYTES): Promise<Blob> {
  for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
    const blob = await encode(quality)
    if (blob.size <= maxBytes) {
      return blob
    }
  }
  throw new OgTooLargeError(`Share image over ${maxBytes} bytes`)
}
