// Every input goes through a strict zod schema (CLAUDE.md "Servidor decide"); unknown keys are rejected
import type { H3Event } from 'h3'
import type { z } from 'zod'

/** ADR-0012 §4; also the early Content-Length check in server/middleware/00.origin-check.ts */
export const MAX_JSON_BYTES = 1_000_000

type ObjectSchema = z.ZodObject<z.ZodRawShape>

function toIssues(error: z.ZodError) {
  return error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
}

function parseStrict<T extends ObjectSchema>(schema: T, input: unknown): z.output<T> {
  const result = schema.strict().safeParse(input)
  if (!result.success) {
    throw createAppError('bad_request', 'Invalid input', toIssues(result.error))
  }
  return result.data as z.output<T>
}

async function readJsonBody(event: H3Event): Promise<unknown> {
  const contentType = getRequestHeader(event, 'content-type') ?? ''
  if (!/^application\/json(;|$)/i.test(contentType)) {
    throw createAppError('unsupported_media_type')
  }
  if (Number(getRequestHeader(event, 'content-length') ?? 0) > MAX_JSON_BYTES) {
    throw createAppError('payload_too_large')
  }
  const raw = await readRawBody(event, false)
  if ((raw?.byteLength ?? 0) > MAX_JSON_BYTES) {
    throw createAppError('payload_too_large')
  }
  return readBody(event)
}

// JSON only: a cross-site HTML form cannot send application/json without a CORS preflight.
// The size is checked on the raw bytes too, since chunked requests carry no Content-Length
export async function readValidatedBodyStrict<T extends ObjectSchema>(event: H3Event, schema: T): Promise<z.output<T>> {
  return parseStrict(schema, await readJsonBody(event))
}

/** For unions (discriminated by a `kind`), whose members must each be `.strict()` already */
export async function readValidatedUnionBody<T extends z.ZodDiscriminatedUnion>(event: H3Event, schema: T): Promise<z.output<T>> {
  const result = schema.safeParse(await readJsonBody(event))
  if (!result.success) {
    throw createAppError('bad_request', 'Invalid input', toIssues(result.error))
  }
  return result.data
}

export function getValidatedQueryStrict<T extends ObjectSchema>(event: H3Event, schema: T): z.output<T> {
  return parseStrict(schema, getQuery(event))
}

export function getValidatedParamsStrict<T extends ObjectSchema>(event: H3Event, schema: T): z.output<T> {
  return parseStrict(schema, getRouterParams(event, { decode: true }))
}
