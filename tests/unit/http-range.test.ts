// F04-T3: single byte ranges for media delivery; anything else is unsatisfiable (416)
import { describe, expect, it } from 'vitest'
import { parseRange } from '../../server/utils/http-range'

describe('parseRange', () => {
  it('reads closed, open and suffix ranges within the size', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ offset: 0, length: 100 })
    expect(parseRange('bytes=900-', 1000)).toEqual({ offset: 900, length: 100 })
    expect(parseRange('bytes=-50', 1000)).toEqual({ offset: 950, length: 50 })
    expect(parseRange('bytes=990-5000', 1000)).toEqual({ offset: 990, length: 10 })
    expect(parseRange('bytes=-5000', 1000)).toEqual({ offset: 0, length: 1000 })
  })

  it('refuses ranges past the end, reversed, empty, multipart or in other units', () => {
    for (const header of ['bytes=1000-', 'bytes=50-10', 'bytes=-', 'bytes=-0', 'bytes=0-1,5-9', 'items=0-1', 'bytes=a-b']) {
      expect(parseRange(header, 1000), header).toBeUndefined()
    }
  })
})
