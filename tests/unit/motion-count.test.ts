// F10-T4: which highlight values count up (storyboard-home §9, decision 2): only numbers the owner wrote, with an
// optional symbol before and any text after; written back exactly like the original at every step and at the end
import { describe, expect, it } from 'vitest'
import { countableStat, formatCount, parseCount } from '../../app/composables/motion/scenes/count'

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

// F13-T2: the home's stats figures. A plain number counts up; a range or a word shows as it is
describe('stats figures', () => {
  it('counts a plain number, with its symbols, and ends on the owner text', () => {
    for (const text of ['6+', '~5M', '90%+']) {
      const count = countableStat(text)
      expect(count, text).not.toBeNull()
      expect(formatCount(count!, count!.value), text).toBe(text)
    }
    expect(countableStat('~5M')).toMatchObject({ prefix: '~', value: 5, suffix: 'M' })
  })

  it('leaves a range and a word unanimated', () => {
    expect(countableStat('70–80%')).toBeNull()
    expect(countableStat('Lisbon')).toBeNull()
    expect(countableStat('')).toBeNull()
  })
})
