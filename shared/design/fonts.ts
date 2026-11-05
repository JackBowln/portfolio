// Self-hosted fonts (ADR-0010 §4, design-direction §9): pairing A from Fontsource 5.3.0, OFL-1.1, vendored in
// public/fonts/v5.3.0 so builds never fetch fonts and the versioned path can be cached as immutable.
// nuxt.config turns this list into @nuxt/fonts families.
//
// Loading (owner decision, F01-T3): no preload. On a first visit the page paints with the metric-matched fallbacks
// @nuxt/fonts generates, and the web fonts are only used, so only downloaded, after the `load` event: measured,
// preloading them pushed the mobile LCP from 1.8 s to 2.9 s. The fallbacks share the fonts' metrics, so the swap
// does not move the layout. Later visits (fonts already in the HTTP cache) use them from the first paint.

export const FONT_BASE_PATH = '/fonts/v5.3.0'

// Fontsource's ranges: latin covers pt, es, de and fr (œ U+0153, ß U+00DF, ñ U+00F1); latin-ext only downloads
// when a page uses characters beyond it
const UNICODE_RANGES = {
  'latin': 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
} as const

export type FontSubset = keyof typeof UNICODE_RANGES
type FontStyle = 'normal' | 'italic'

export interface FontFamily {
  /** The name the --font-* tokens in main.css use */
  name: string
  /** The --font-* token that names this family */
  token: '--font-display' | '--font-sans' | '--font-mono'
  /** Folder and file prefix in FONT_BASE_PATH */
  slug: string
  /** Fontsource axis file: opsz (optical size + weight) or wght */
  axes: 'opsz' | 'wght'
  weight: string
  styles: readonly FontStyle[]
  /** Local system fonts @nuxt/fonts builds the metric-matched fallbacks from */
  fallbacks: readonly string[]
  /** Generic families closing the stack, as in main.css */
  generic: readonly string[]
}

export const FONT_FAMILIES: readonly FontFamily[] = [
  { name: 'Fraunces', token: '--font-display', slug: 'fraunces', axes: 'opsz', weight: '100 900', styles: ['normal', 'italic'], fallbacks: ['Georgia', 'Times New Roman'], generic: ['ui-serif', 'Georgia', 'serif'] },
  { name: 'Inter', token: '--font-sans', slug: 'inter', axes: 'wght', weight: '100 900', styles: ['normal', 'italic'], fallbacks: ['Arial'], generic: ['ui-sans-serif', 'system-ui', 'sans-serif'] },
  { name: 'JetBrains Mono', token: '--font-mono', slug: 'jetbrains-mono', axes: 'wght', weight: '100 800', styles: ['normal'], fallbacks: ['Menlo', 'Courier New'], generic: ['ui-monospace', '"SFMono-Regular"', 'Menlo', 'monospace'] },
]

export interface FontFace {
  family: string
  src: string
  weight: string
  style: FontStyle
  subset: FontSubset
  unicodeRange: string
}

export function fontFaces(family: FontFamily): FontFace[] {
  return family.styles.flatMap(style => (Object.keys(UNICODE_RANGES) as FontSubset[]).map(subset => ({
    family: family.name,
    src: `${FONT_BASE_PATH}/${family.slug}/${family.slug}-${subset}-${family.axes}-${style}.woff2`,
    weight: family.weight,
    style,
    subset,
    unicodeRange: UNICODE_RANGES[subset],
  })))
}

/** The names @nuxt/fonts gives the metric-matched fallback faces it generates ("Inter Fallback: Arial") */
export function fallbackFamilies(family: FontFamily): string[] {
  return family.fallbacks.map(local => `"${family.name} Fallback: ${local}"`)
}

/** The token value main.css declares: the web font first */
export function fontStack(family: FontFamily): string {
  return [`"${family.name}"`, ...family.generic].join(', ')
}

const PENDING_CLASS = 'fonts-pending'
const FONTS_STORAGE_KEY = 'fonts'

/**
 * F11-T5: Fraunces has an optical-size axis, so the larger the text, the narrower its glyphs, while the fallback faces
 * @nuxt/fonts generates match its default size. Set in the fallback, a 100 px title was ~17% wider, wrapped into twice
 * the lines and pushed the page down when the web font came in (CLS 0.06 on the case study, desktop). Measured width
 * of Fraunces ÷ its Georgia fallback, by step and viewport (Chrome, 2026-11-05):
 *
 * | step | 412 px | 768 px | 1024 px | 1350 px | 1920 px |
 * |---|---|---|---|---|---|
 * | 5 | 0.969 | 0.952 | 0.935 | 0.911 | 0.896 |
 * | 6 | 0.957 | 0.922 | 0.861 | 0.831 | 0.829 |
 * | 7 | 0.937 | 0.834 | 0.824 | 0.822 | 0.822 |
 *
 * So display titles get narrower copies of the fallback by size: each is @nuxt/fonts' face for that local font with
 * size-adjust times the scale, and the vertical overrides divided by it, so line boxes keep their height. Local fonts
 * only: nothing is downloaded. The values of @nuxt/fonts are checked against the build by tests/unit/fonts.test.ts
 */
export const DISPLAY_FALLBACK_METRICS: Record<string, { sizeAdjust: number, ascent: number, descent: number }> = {
  'Georgia': { sizeAdjust: 105.204, ascent: 92.9623, descent: 24.2386 },
  'Times New Roman': { sizeAdjust: 115.446, ascent: 84.7148, descent: 22.0882 },
}
const LOCAL_NAMES: Record<string, string[]> = {
  'Georgia': ['Georgia', 'Georgia Regular', 'Georgia-Regular'],
  'Times New Roman': ['Times New Roman', 'Times New Roman Regular', 'TimesNewRoman-Regular', 'TimesNewRomanPSMT'],
}
export const DISPLAY_SCALES = [95, 91, 86, 83] as const
/** Which scale a step uses from a viewport width (rem) up, from the table above */
export const DISPLAY_FALLBACK_RULES: readonly { step: 5 | 6 | 7, minWidth: number, scale: (typeof DISPLAY_SCALES)[number] }[] = [
  { step: 5, minWidth: 48, scale: 95 },
  { step: 5, minWidth: 84, scale: 91 },
  { step: 6, minWidth: 0, scale: 95 },
  { step: 6, minWidth: 48, scale: 91 },
  { step: 6, minWidth: 64, scale: 86 },
  { step: 6, minWidth: 84, scale: 83 },
  { step: 7, minWidth: 0, scale: 95 },
  { step: 7, minWidth: 48, scale: 83 },
]

const round = (value: number) => Number(value.toFixed(3))
const displayFamily = (scale: number, local: string) => `"Fraunces Fallback ${scale}: ${local}"`

function displayFallbackCss(): string {
  const faces = DISPLAY_SCALES.flatMap(scale => Object.entries(DISPLAY_FALLBACK_METRICS).map(([local, metrics]) => {
    const factor = scale / 100
    return `@font-face{font-family:${displayFamily(scale, local)};src:${LOCAL_NAMES[local]!.map(name => `local(${name})`).join(',')};size-adjust:${round(metrics.sizeAdjust * factor)}%;ascent-override:${round(metrics.ascent / factor)}%;descent-override:${round(metrics.descent / factor)}%;line-gap-override:0%}`
  }))
  const generic = FONT_FAMILIES.find(family => family.token === '--font-display')!.generic
  // Twice: while pending, the narrow fallback alone; after, Fraunces first and the same fallback while it downloads,
  // or the title would widen for that moment and shift twice
  const rules = DISPLAY_FALLBACK_RULES.map(({ step, minWidth, scale }) => {
    const fallbacks = [...Object.keys(DISPLAY_FALLBACK_METRICS).map(local => displayFamily(scale, local)), ...generic].join(',')
    const rule = `.font-display.text-step-${step}{font-family:"Fraunces",${fallbacks}}:root.${PENDING_CLASS} .font-display.text-step-${step}{font-family:${fallbacks}}`
    return minWidth === 0 ? rule : `@media (min-width:${minWidth}rem){${rule}}`
  })
  return [...faces, ...rules].join('')
}

/** While pending, the tokens name only the fallbacks, so the browser neither uses nor downloads the web fonts */
export const FONT_PENDING_CSS = `:root.${PENDING_CLASS}{${FONT_FAMILIES
  .map(family => `${family.token}:${[...fallbackFamilies(family), ...family.generic].join(',')}`)
  .join(';')}}`

/**
 * Display titles in the narrower fallbacks of their size, pending or while Fraunces downloads (F11-T5). Added to the
 * HTML by server/plugins/display-fallback-css.ts: in app.head it would be serialized into every page's JS too
 */
export const DISPLAY_FALLBACK_CSS = displayFallbackCss()

/**
 * Runs inline in <head>. First visit: hold the web fonts until the first frame after `load` has painted (an image
 * that finished loading with the page, such as a list's LCP cover, paints before the font requests compete with it;
 * F06-T5), then let them in and remember they are cached (one frame later, once the font requests have started).
 * Without JS nothing is held and the fonts load like any other. Static, for the CSP hash (F03-T4).
 */
export const FONT_LOADING_SCRIPT = `try{if(!localStorage.getItem(${JSON.stringify(FONTS_STORAGE_KEY)})){var d=document.documentElement;d.classList.add(${JSON.stringify(PENDING_CLASS)});addEventListener("load",function(){requestAnimationFrame(function(){setTimeout(function(){d.classList.remove(${JSON.stringify(PENDING_CLASS)});requestAnimationFrame(function(){document.fonts.ready.then(function(){try{localStorage.setItem(${JSON.stringify(FONTS_STORAGE_KEY)},"1")}catch(e){}})})})})})}}catch(e){}`
