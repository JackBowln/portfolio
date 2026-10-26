import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema/index.ts'

export type Db = DrizzleD1Database<typeof schema>

/** Cheap to call: one instance per request, since the D1 binding only exists inside it (ADR-0004 §2) */
export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema, casing: 'snake_case' })
}
