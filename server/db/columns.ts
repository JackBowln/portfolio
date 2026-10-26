import { customType } from 'drizzle-orm/sqlite-core'
import type { z } from 'zod'
import { decodeJson, encodeJson } from '../../shared/utils/json.ts'

/** JSON stored as text, validated with `schema` when written and when read (ADR-0004 §4) */
export function zodJson<T extends z.ZodType>(schema: T) {
  return customType<{ data: z.output<T>, driverData: string }>({
    dataType: () => 'text',
    // A Drizzle column has one data type; JSON schemas here have identical input and output, and parse() re-validates
    toDriver: value => encodeJson(schema, value as z.input<T>),
    fromDriver: value => decodeJson(schema, value),
  })
}
