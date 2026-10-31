// Every input goes through a strict zod schema (CLAUDE.md "Servidor decide"); unknown keys are rejected
import type { H3Event } from 'h3'
import type { z } from 'zod'

/** ADR-0012 §4; also the early Content-Length check in server/middleware/00.origin-check.ts */
export const MAX_JSON_BYTES = 1_000_000

type ObjectSchema = z.ZodObject<z.ZodRawShape>

function toIssues(error: z.ZodError) {
  return error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
}

// The public form never reflects input (security-model §2): zod names unknown keys in its message, so anything that
// is not one of our message codes becomes `invalid`, and a path that is not a known field becomes ''
function toPublicIssues(error: z.ZodError, fields: readonly string[]) {
  return toIssues(error).map(issue => ({
    path: fields.includes(issue.path) ? issue.path : '',
    message: /^[a-z_]{1,32}$/.test(issue.message) ? issue.message : 'invalid',
  }))
}

function parseStrict<T extends ObjectSchema>(schema: T, input: unknown, code: 'bad_request' | 'unprocessable' = 'bad_request'): z.output<T> {
  const result = schema.strict().safeParse(input)
  if (!result.success) {
    throw createAppError(code, 'Invalid input', toIssues(result.error))
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

/** The public contact form (F08-T3): field errors are a 422 with codes only, so the form tells them apart from a refused request */
export async function readValidatedFields<T extends ObjectSchema>(event: H3Event, schema: T): Promise<z.output<T>> {
  const result = schema.strict().safeParse(await readJsonBody(event))
  if (!result.success) {
    throw createAppError('unprocessable', 'Invalid input', toPublicIssues(result.error, Object.keys(schema.shape)))
  }
  return result.data as z.output<T>
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
