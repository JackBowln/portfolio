// Public data and pages (ADR-0003 §2, F06-T5 decision 4): stored at the edge for 7 days and purged by tag. Called
// by the public API routes; the pages set the same tags on their HTML
import type { H3Event } from 'h3'

export function cachePublicly(event: H3Event, tags: readonly string[]): void {
  setCachePolicy(event, 'public')
  setCacheTags(event, [...new Set(tags)])
}
