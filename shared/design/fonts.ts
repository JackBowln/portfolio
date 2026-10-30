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

/** While pending, the tokens name only the fallbacks, so the browser neither uses nor downloads the web fonts */
export const FONT_PENDING_CSS = `:root.${PENDING_CLASS}{${FONT_FAMILIES
  .map(family => `${family.token}:${[...fallbackFamilies(family), ...family.generic].join(',')}`)
  .join(';')}}`

/**
 * Runs inline in <head>. First visit: hold the web fonts until the first frame after `load` has painted (an image
 * that finished loading with the page, such as a list's LCP cover, paints before the font requests compete with it;
 * F06-T5), then let them in and remember they are cached (one frame later, once the font requests have started).
 * Without JS nothing is held and the fonts load like any other. Static, for the CSP hash (F03-T4).
 */
export const FONT_LOADING_SCRIPT = `try{if(!localStorage.getItem(${JSON.stringify(FONTS_STORAGE_KEY)})){var d=document.documentElement;d.classList.add(${JSON.stringify(PENDING_CLASS)});addEventListener("load",function(){requestAnimationFrame(function(){setTimeout(function(){d.classList.remove(${JSON.stringify(PENDING_CLASS)});requestAnimationFrame(function(){document.fonts.ready.then(function(){try{localStorage.setItem(${JSON.stringify(FONTS_STORAGE_KEY)},"1")}catch(e){}})})})})})}}catch(e){}`
