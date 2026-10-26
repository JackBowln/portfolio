// Request id + one structured log line per request (ADR-0012 §7): no IP, query string, headers or body
// Workers only advance the clock after I/O, so durationMs measures wall time spent waiting, not CPU
const INTERNAL_PATHS = ['/__nuxt_error']
const MAX_MESSAGE_LENGTH = 300

function routeOf(path: string): string {
  return path.split('?')[0] ?? path
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    event.context.requestId = getRequestHeader(event, 'cf-ray') ?? crypto.randomUUID()
    event.context.startedAt = Date.now()
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    const route = routeOf(event.path)
    if (INTERNAL_PATHS.some(path => route.startsWith(path))) {
      return
    }
    logger.info('request', {
      requestId: event.context.requestId,
      method: event.method,
      route,
      status: getResponseStatus(event),
      durationMs: Date.now() - (event.context.startedAt ?? Date.now()),
    })
  })

  // Thrown errors skip afterResponse, so their request line is written here. Stacks stay out of production logs;
  // the client only ever sees the generic error body
  nitroApp.hooks.hook('error', (error, { event }) => {
    const status = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500
    const fields = {
      requestId: event?.context.requestId,
      method: event?.method,
      route: event ? routeOf(event.path) : undefined,
      status,
    }
    if (status < 500) {
      logger.info('request', fields)
      return
    }
    logger.error('request.error', {
      ...fields,
      error: error.name,
      message: error.message.slice(0, MAX_MESSAGE_LENGTH),
      stack: import.meta.dev ? error.stack : undefined,
    })
  })
})
