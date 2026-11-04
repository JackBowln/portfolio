// F10-T4: which highlight values count up (storyboard-home §9, decision 2): only numbers the owner wrote, with an
// optional symbol before and any text after; written back exactly like the original at every step and at the end
import { describe, expect, it } from 'vitest'
import { formatCount, parseCount } from '../../app/composables/motion/scenes/count'

describe('highlight counters', () => {
  it('counts numbers with their symbols, separators and text, and ends on the original', () => {
    for (const text of ['40%', '3x', '1.200 visitas', '+25%', 'R$ 2,5 mi', '12 000', '-15 ms', '~3,25']) {
      const count = parseCount(text)
      expect(count, text).not.toBeNull()
      expect(formatCount(count!, count!.value), text).toBe(text)
    }
    expect(parseCount('1.200')).toMatchObject({ value: 1200, decimals: 0, group: '.' })
    expect(parseCount('1,5')).toMatchObject({ value: 1.5, decimals: 1, point: ',' })
    expect(formatCount(parseCount('1.200 visitas')!, 600)).toBe('600 visitas')
    expect(formatCount(parseCount('R$ 2,5 mi')!, 1.25)).toBe('R$ 1,3 mi')
  })

  it('never counts a placeholder, a word or a zero', () => {
    for (const text of ['[PLACEHOLDER]', 'rápido', 'Top 10', '0', '', 'v2']) {
      expect(parseCount(text), text).toBeNull()
    }
  })
})
