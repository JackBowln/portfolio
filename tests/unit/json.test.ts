import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { decodeJson, encodeJson } from '../../shared/utils/json'

const schema = z.object({ enabled: z.boolean(), cap: z.number().int().nonnegative() }).strict()

describe('JSON column codec', () => {
  it('round-trips a valid value', () => {
    const text = encodeJson(schema, { enabled: true, cap: 8000 })

    expect(decodeJson(schema, text)).toEqual({ enabled: true, cap: 8000 })
  })

  it('rejects an invalid value on write', () => {
    expect(() => encodeJson(schema, { enabled: 'yes', cap: 1 } as never)).toThrow()
    expect(() => encodeJson(schema, { enabled: true, cap: 1, extra: 1 } as never)).toThrow()
  })

  it('rejects stored data with the wrong shape on read', () => {
    expect(() => decodeJson(schema, '{"enabled":true,"cap":-1}')).toThrow()
  })

  it('rejects text that is not JSON', () => {
    expect(() => decodeJson(schema, '{enabled: true')).toThrow(SyntaxError)
  })
})
