// The part of app/assets/css/main.css that JS needs (ADR-0010 §2): motion for GSAP, breakpoints for matchMedia,
// and the type scale the styleguide documents. tests/unit/design-tokens.test.ts checks it against the CSS.

/** ms, docs/design/motion-principles.md §2 */
export const DURATIONS = {
  instant: 120,
  fast: 200,
  base: 320,
  slow: 500,
  cinematic: 800,
} as const

export const EASINGS = {
  'out': 'cubic-bezier(0.22, 1, 0.36, 1)',
  'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
  'emphasis': 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

/** px */
export const DISTANCES = { sm: 8, md: 24 } as const

/** rem, --container-reading (the reading measure) and --container-max (1440 px) */
export const CONTAINERS = { reading: 53, max: 90 } as const

/**
 * `sizes` for images across the reading measure, a third of it (grid gallery), or the default container, minus the
 * gutter at its largest (2.5rem). Always rem: inside `sizes`, ch resolves against the browser's initial font, not
 * the page's, and asks for an image too small
 */
export const IMAGE_SIZES = {
  reading: '(min-width: 53rem) 48rem, 100vw',
  readingThird: '(min-width: 53rem) 16rem, 50vw',
  wide: '(min-width: 90rem) 85rem, 100vw',
} as const

/** px, min-width */
export const BREAKPOINTS = { 'sm': 640, 'md': 768, 'lg': 1024, 'xl': 1280, '2xl': 1536 } as const

export interface TypeStep {
  step: number
  minPx: number
  maxPx: number
  leading: number
}

export const TYPE_SCALE: readonly TypeStep[] = [
  { step: -1, minPx: 13, maxPx: 14, leading: 1.5 },
  { step: 0, minPx: 17, maxPx: 20, leading: 1.65 },
  { step: 1, minPx: 20, maxPx: 24, leading: 1.5 },
  { step: 2, minPx: 24, maxPx: 32, leading: 1.3 },
  { step: 3, minPx: 28, maxPx: 42, leading: 1.2 },
  { step: 4, minPx: 34, maxPx: 56, leading: 1.1 },
  { step: 5, minPx: 40, maxPx: 76, leading: 1.05 },
  { step: 6, minPx: 48, maxPx: 104, leading: 1 },
  { step: 7, minPx: 56, maxPx: 160, leading: 0.95 },
]

/** From this step up the scale uses the display family and tighter tracking */
export const DISPLAY_FROM_STEP = 3

export const FLUID_VIEWPORT = { minPx: 360, maxPx: 1440 } as const

const ROOT_PX = 16
const round = (value: number) => Number(value.toFixed(4))

/** clamp() that grows linearly from minPx at the narrow viewport to maxPx at the wide one */
export function fluidSize({ minPx, maxPx }: Pick<TypeStep, 'minPx' | 'maxPx'>): string {
  const slope = (maxPx - minPx) / (FLUID_VIEWPORT.maxPx - FLUID_VIEWPORT.minPx)
  const intercept = minPx - slope * FLUID_VIEWPORT.minPx
  return `clamp(${round(minPx / ROOT_PX)}rem, ${round(intercept / ROOT_PX)}rem + ${round(slope * 100)}vw, ${round(maxPx / ROOT_PX)}rem)`
}
