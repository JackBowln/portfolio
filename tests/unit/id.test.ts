import { describe, expect, it } from 'vitest'
import { isUuidv7, uuidv7 } from '../../shared/utils/id'

describe('uuidv7', () => {
  it('has the RFC 9562 version and variant bits', () => {
    const id = uuidv7()

    expect(isUuidv7(id)).toBe(true)
    expect(id[14]).toBe('7')
    expect(['8', '9', 'a', 'b']).toContain(id[19])
  })

  it('encodes the timestamp in the first 48 bits', () => {
    // Ahead of every id generated so far, so monotonic ordering does not reuse the last millisecond
    const at = Date.now() + 365 * 24 * 3600 * 1000
    const id = uuidv7(at)

    expect(Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(at)
  })

  it('is unique and strictly increasing in a batch, even within one millisecond', () => {
    const at = Date.now() + 60_000
    const ids = Array.from({ length: 10_000 }, () => uuidv7(at))

    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(ids)
  })

  it('stays ordered when the clock goes backwards', () => {
    const first = uuidv7(Date.now() + 120_000)
    const second = uuidv7(Date.now())

    expect(second > first).toBe(true)
  })
})
