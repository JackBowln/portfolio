// Application errors carry a stable code; anything else becomes a generic 500 in production (ADR-0012 §4)
export type AppErrorCode
  = | 'bad_request'
    | 'unauthorized'
    | 'forbidden'
    | 'session_not_fresh'
    | 'not_found'
    | 'conflict'
    | 'payload_too_large'
    | 'unsupported_media_type'
    | 'unprocessable'
    | 'rate_limited'
    | 'internal'

const STATUS: Record<AppErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  // Sensitive admin actions need a recent sign-in (ADR-0005 §4); the admin asks the user to authenticate again
  session_not_fresh: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
  // Field errors of the public contact form (F08-T3); admin routes keep 400 for invalid input
  unprocessable: 422,
  rate_limited: 429,
  internal: 500,
}

export interface AppErrorData {
  code: AppErrorCode
  issues?: { path: string, message: string }[]
}

export function createAppError(code: AppErrorCode, message?: string, issues?: AppErrorData['issues']) {
  const data: AppErrorData = issues ? { code, issues } : { code }
  return createError({ statusCode: STATUS[code], statusMessage: message ?? code, data })
}

/** A D1 unique constraint failure; Drizzle wraps it ("Failed query: …"), with D1's message in the cause */
export function isUniqueViolation(error: unknown): boolean {
  return [error, (error as { cause?: unknown } | null)?.cause].some(item => item instanceof Error && item.message.includes('UNIQUE constraint failed'))
}
