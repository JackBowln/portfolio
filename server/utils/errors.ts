// Application errors carry a stable code; anything else becomes a generic 500 in production (ADR-0012 §4)
export type AppErrorCode
  = | 'bad_request'
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 'payload_too_large'
    | 'unsupported_media_type'
    | 'rate_limited'
    | 'internal'

const STATUS: Record<AppErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
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
