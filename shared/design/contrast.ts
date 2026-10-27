// WCAG 2.x contrast for OKLCH colors.
// OKLab → linear sRGB matrices from Björn Ottosson's reference implementation (https://bottosson.github.io/posts/oklab/).

export interface Oklch {
  /** Perceptual lightness, 0–1 */
  l: number
  c: number
  /** Hue in degrees */
  h: number
}

export type ContrastUse = 'text' | 'large-text' | 'ui'

/** WCAG 2.2 AA minimums: 1.4.3 (text) and 1.4.11 (non-text) */
export const AA_MINIMUM: Readonly<Record<ContrastUse, number>> = {
  'text': 4.5,
  'large-text': 3,
  'ui': 3,
}

const GAMUT_EPSILON = 1e-6

export function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hue = (h * Math.PI) / 180
  const a = c * Math.cos(hue)
  const b = c * Math.sin(hue)

  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const short = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3

  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.7076147010 * short,
  ]
}

export function isInSrgbGamut(color: Oklch): boolean {
  return oklchToLinearSrgb(color).every(channel => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON)
}

/** WCAG relative luminance; out-of-gamut channels are clipped, roughly as a browser would render them */
export function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(color)
  const clip = (channel: number) => Math.min(1, Math.max(0, channel))
  return 0.2126 * clip(r) + 0.7152 * clip(g) + 0.0722 * clip(b)
}

export function contrastRatio(foreground: Oklch, background: Oklch): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

export function meetsAA(ratio: number, use: ContrastUse): boolean {
  return ratio >= AA_MINIMUM[use]
}

export interface ContrastPair {
  foreground: string
  background: string
  use: ContrastUse
}

/** Every semantic pair the UI draws (design-tokens reference, "Contraste"); checked in both themes */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { foreground: 'text', background: 'bg', use: 'text' },
  { foreground: 'text', background: 'surface', use: 'text' },
  { foreground: 'text-muted', background: 'bg', use: 'text' },
  { foreground: 'text-muted', background: 'surface', use: 'text' },
  // The accent is also the link color
  { foreground: 'accent', background: 'bg', use: 'text' },
  { foreground: 'accent', background: 'surface', use: 'text' },
  { foreground: 'accent-contrast', background: 'accent', use: 'text' },
  { foreground: 'accent-contrast', background: 'accent-hover', use: 'text' },
  { foreground: 'accent-contrast', background: 'accent-active', use: 'text' },
  { foreground: 'text', background: 'surface-active', use: 'text' },
  { foreground: 'focus', background: 'surface-active', use: 'ui' },
  { foreground: 'focus', background: 'bg', use: 'ui' },
  { foreground: 'focus', background: 'surface', use: 'ui' },
  { foreground: 'border', background: 'bg', use: 'ui' },
  { foreground: 'success', background: 'bg', use: 'text' },
  { foreground: 'success', background: 'surface', use: 'text' },
  { foreground: 'warning', background: 'bg', use: 'text' },
  { foreground: 'warning', background: 'surface', use: 'text' },
  { foreground: 'danger', background: 'bg', use: 'text' },
  { foreground: 'danger', background: 'surface', use: 'text' },
]

export interface ContrastResult extends ContrastPair {
  theme: string
  ratio: number
  pass: boolean
}

export interface ContrastReport {
  results: ContrastResult[]
  /** Pairs that name a missing token, and colors outside sRGB (rendered clipped, so the ratio would be a guess) */
  problems: string[]
}

/** Checks every pair in every theme; the report fails on any ratio under AA and on any problem */
export function checkContrast(themes: Record<string, Record<string, Oklch>>, pairs: readonly ContrastPair[] = CONTRAST_PAIRS): ContrastReport {
  const results: ContrastResult[] = []
  const problems: string[] = []
  for (const [theme, colors] of Object.entries(themes)) {
    for (const [token, color] of Object.entries(colors)) {
      if (!isInSrgbGamut(color)) {
        problems.push(`${theme}: ${token} is outside sRGB`)
      }
    }
    for (const pair of pairs) {
      const foreground = colors[pair.foreground]
      const background = colors[pair.background]
      if (!foreground || !background) {
        problems.push(`${theme}: ${pair.foreground} × ${pair.background} names a missing token`)
        continue
      }
      const ratio = contrastRatio(foreground, background)
      results.push({ ...pair, theme, ratio, pass: meetsAA(ratio, pair.use) })
    }
  }
  return { results, problems }
}

export function contrastPasses(report: ContrastReport): boolean {
  return report.problems.length === 0 && report.results.every(result => result.pass)
}
