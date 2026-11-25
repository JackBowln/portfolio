// F13-T1: the home's stats strip is part of the home blocks. Pages saved before it existed still parse (with no
// stats), at most four figures are accepted, each one is strict, and the empty blocks start with none
import { describe, expect, it } from 'vitest'
import { EMPTY_PAGE_BLOCKS, pageBlockSchemas } from '../../shared/pages/blocks'
import { pageUpdateSchema } from '../../shared/pages/input'

const home = pageBlockSchemas.home
// The blocks as they were stored before F13-T1: no stats key at all
const { stats: _stats, ...withoutStats } = EMPTY_PAGE_BLOCKS.home

describe('home stats block', () => {
  it('starts empty, and the empty blocks pass the schema', () => {
    expect(EMPTY_PAGE_BLOCKS.home.stats).toEqual([])
    expect(home.safeParse(EMPTY_PAGE_BLOCKS.home).success).toBe(true)
  })

  it('a page saved before the field existed parses with no stats', () => {
    const parsed = home.safeParse(withoutStats)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.stats).toEqual([])
  })

  it('accepts figures as written, up to four', () => {
    const stats = [
      { value: '6+', label: 'Years experience' },
      { value: '70–80%', label: 'Faster load times' },
    ]
    expect(home.safeParse({ ...EMPTY_PAGE_BLOCKS.home, stats }).success).toBe(true)
    const five = Array.from({ length: 5 }, (_, index) => ({ value: String(index), label: 'x' }))
    expect(home.safeParse({ ...EMPTY_PAGE_BLOCKS.home, stats: five }).success).toBe(false)
  })

  it('is strict: unknown fields and over-long values are rejected', () => {
    expect(home.safeParse({ ...EMPTY_PAGE_BLOCKS.home, stats: [{ value: '1', label: 'x', icon: 'star' }] }).success).toBe(false)
    expect(home.safeParse({ ...EMPTY_PAGE_BLOCKS.home, stats: [{ value: '1234567890123', label: 'x' }] }).success).toBe(false)
    expect(home.safeParse({ ...EMPTY_PAGE_BLOCKS.home, stats: [{ value: '1', label: 'x'.repeat(61) }] }).success).toBe(false)
  })

  it('the save schema accepts stats and still rejects unknown home fields', () => {
    const schema = pageUpdateSchema('home')
    const stats = [{ value: '5M+', label: 'Users served' }]
    expect(schema.safeParse({ version: 1, blocks: { ...EMPTY_PAGE_BLOCKS.home, stats } }).success).toBe(true)
    expect(schema.safeParse({ version: 1, blocks: { ...EMPTY_PAGE_BLOCKS.home, extra: 1 } }).success).toBe(false)
  })
})
