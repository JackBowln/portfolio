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
