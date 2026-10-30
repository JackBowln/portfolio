// F01-T2: shared/design/tokens.ts mirrors app/assets/css/main.css (ADR-0010 §2); a change on one side fails here
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { customProperties } from '../../shared/design/css-tokens'
import { BREAKPOINTS, CONTAINERS, DISPLAY_FROM_STEP, DISTANCES, DURATIONS, EASINGS, fluidSize, TYPE_SCALE } from '../../shared/design/tokens'

const MAIN_CSS = readFileSync('app/assets/css/main.css', 'utf8')
const tokens = customProperties(MAIN_CSS)

describe('design tokens mirror', () => {
  it('motion', () => {
    for (const [name, ms] of Object.entries(DURATIONS)) {
      expect(tokens.get(`--dur-${name}`), name).toBe(`${ms}ms`)
    }
    for (const [name, value] of Object.entries(EASINGS)) {
      expect(tokens.get(`--ease-${name}`), name).toBe(value)
    }
    for (const [name, px] of Object.entries(DISTANCES)) {
      expect(tokens.get(`--distance-${name}`), name).toBe(`${px}px`)
    }
  })

  it('containers', () => {
    expect(tokens.get('--container-reading')).toBe(`${CONTAINERS.reading}rem`)
    expect(tokens.get('--container-max')).toBe(`${CONTAINERS.max * 16}px`)
  })

  it('breakpoints', () => {
    for (const [name, px] of Object.entries(BREAKPOINTS)) {
      expect(tokens.get(`--breakpoint-${name}`), name).toBe(`${px / 16}rem`)
    }
  })

  it('type scale: fluid size, line height and display tracking per step', () => {
    for (const step of TYPE_SCALE) {
      const name = `--text-step-${step.step}`
      expect(tokens.get(name), name).toBe(fluidSize(step))
      expect(tokens.get(`${name}--line-height`), name).toBe(String(step.leading))
      expect(tokens.has(`${name}--letter-spacing`), name).toBe(step.step >= DISPLAY_FROM_STEP)
    }
  })

  it('Tailwind defaults are reset, so utilities exist only for project tokens', () => {
    expect(MAIN_CSS).toMatch(/@theme static \{\s*--\*: initial;/)
  })
})
