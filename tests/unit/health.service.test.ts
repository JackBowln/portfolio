import { describe, expect, it } from 'vitest'
import { getHealth } from '../../server/services/health/health.service'

describe('getHealth', () => {
  it('reports ok with the given version', () => {
    expect(getHealth('1.2.3')).toEqual({ status: 'ok', version: '1.2.3' })
  })
})
