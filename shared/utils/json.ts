// JSON columns are validated with zod on write and on read (ADR-0004 §4)
import type { z } from 'zod'

export function encodeJson<T extends z.ZodType>(schema: T, value: z.input<T>): string {
  return JSON.stringify(schema.parse(value))
}

export function decodeJson<T extends z.ZodType>(schema: T, text: string): z.output<T> {
  return schema.parse(JSON.parse(text))
}
