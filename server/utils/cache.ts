import type { H3Event } from 'h3'
// Relative so the unit project can import it without Nuxt aliases
import { assertValidCacheTags } from '../../shared/cache/tags'

// ADR-0003 (F00-T6 decision): shared cache for 7 days, browser always revalidates; purge by tag on every change
export const CACHE_POLICIES = {
  public: 'public, max-age=0, s-maxage=604800',
  private: 'private, no-store',
  none: 'no-store',
} as const

export type CachePolicy = keyof typeof CACHE_POLICIES

// Cloudflare caps the Cache-Tag header at 16 KB
const MAX_TAG_HEADER_BYTES = 16_000

export function setCachePolicy(event: H3Event, policy: CachePolicy): void {
  setResponseHeader(event, 'cache-control', CACHE_POLICIES[policy])
}

/** Adds tags to the response, keeping any already set; throws on invalid tags instead of sending them */
export function setCacheTags(event: H3Event, tags: readonly string[]): void {
  assertValidCacheTags(tags)
  const current = String(getResponseHeader(event, 'cache-tag') ?? '').split(',').filter(Boolean)
  const value = [...new Set([...current, ...tags])].join(',')
  if (new TextEncoder().encode(value).length > MAX_TAG_HEADER_BYTES) {
    throw new Error(`Cache-Tag header over ${MAX_TAG_HEADER_BYTES} bytes`)
  }
  setResponseHeader(event, 'cache-tag', value)
}

/** Purges Workers Cache entries by tag; a no-op where the cache does not exist (local dev, tests) */
export async function purgeCacheTags(event: H3Event, tags: readonly string[]): Promise<void> {
  // Nitro types the context with an older workers-types; the generated ExecutionContext has `cache`
  await purgeCacheTagsIn(event.context.cloudflare?.context as ExecutionContext | undefined, tags)
}

/** The same purge from a Worker context without a request, such as the cron's scheduled handler (F06-T4) */
export async function purgeCacheTagsIn(context: ExecutionContext | undefined, tags: readonly string[]): Promise<void> {
  assertValidCacheTags(tags)
  const cache = context?.cache
  if (!cache) {
    logger.info('cache.purge.skipped', { reason: 'no workers cache', tags: tags.join(',') })
    return
  }
  const result = await cache.purge({ tags: [...tags] })
  if (!result.success) {
    logger.error('cache.purge.failed', { tags: tags.join(','), errors: result.errors.map(error => error.message).join('; ') })
    throw new Error('Cache purge failed')
  }
  logger.info('cache.purge', { tags: tags.join(',') })
}
