// Per-request fields set by server/plugins/request-context.ts and server/middleware/admin-session.ts
import type { AdminAuth } from '../utils/authz'

declare module 'h3' {
  interface H3EventContext {
    requestId?: string
    startedAt?: number
    /** Only on /api/admin/**, after the session middleware */
    auth?: AdminAuth
  }
}

export {}
