// Tags to purge for each content event (ADR-0003 §3), computed in one place so publishing, unpublishing and the
// schedule cron purge exactly the same set
import type { Locale } from '../types/enums.ts'
import { cacheTags } from './tags.ts'

export interface ArticleEvent {
  id: string
  locale: Locale
  /** Topics before and after the event: a topic page lists the article or stops listing it */
  tagIds: readonly string[]
  /** A redirect was created (a published slug changed) */
  redirect?: boolean
}

/** Publish, unpublish or a scheduled publish of one article localization */
export function articlePurgeTags(event: ArticleEvent): string[] {
  return [...new Set([
    cacheTags.articleLocale(event.id, event.locale),
    cacheTags.blogList(event.locale),
    cacheTags.sitemap(),
    cacheTags.rss(event.locale),
    ...event.tagIds.map(cacheTags.tag),
    ...(event.redirect ? [cacheTags.redirects()] : []),
  ])]
}
