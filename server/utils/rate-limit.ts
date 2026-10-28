// Native rate limiting binding (ADR-0012 §6). Counters are per Cloudflare location and approximate by design.
// All bindings use a 60 s period (wrangler.jsonc), which is also the Retry-After a client gets
import type { H3Event } from 'h3'

const PERIOD_SECONDS = 60

export async function enforceRateLimit(event: H3Event, limiter: RateLimit | undefined, key: string, binding: string): Promise<void> {
  // Every environment declares the bindings; a missing one is a deploy mistake, logged rather than locking everyone out
  if (!limiter) {
    logger.error('rate_limit.binding_missing', { requestId: event.context.requestId, binding })
    return
  }
  const { success } = await limiter.limit({ key })
  if (!success) {
    setResponseHeader(event, 'retry-after', PERIOD_SECONDS)
    throw createAppError('rate_limited')
  }
}
