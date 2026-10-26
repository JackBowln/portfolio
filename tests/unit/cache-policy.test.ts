import { describe, expect, it } from 'vitest'
import { CACHE_POLICIES } from '../../server/utils/cache'

describe('CACHE_POLICIES', () => {
  it('stores public pages at the edge for 7 days and makes browsers revalidate (ADR-0003)', () => {
    expect(CACHE_POLICIES.public).toBe('public, max-age=0, s-maxage=604800')
  })

  it('never stores private or uncached responses', () => {
    expect(CACHE_POLICIES.private).toBe('private, no-store')
    expect(CACHE_POLICIES.none).toBe('no-store')
  })
})
