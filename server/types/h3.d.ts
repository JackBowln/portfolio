// Per-request fields set by server/plugins/request-context.ts
declare module 'h3' {
  interface H3EventContext {
    requestId?: string
    startedAt?: number
  }
}

export {}
