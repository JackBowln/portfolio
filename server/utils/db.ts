import type { H3Event } from 'h3'
import { createDb } from '../db/client.ts'
import type { Db } from '../db/client.ts'

/** Drizzle over this request's D1 binding; services receive the result as a parameter */
export function useDb(event: H3Event): Db {
  return createDb(useEnv(event).DB)
}
