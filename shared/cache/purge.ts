// Tags to purge for each content event (ADR-0003 §3), computed in one place so publishing, unpublishing and the
// schedule cron purge exactly the same set
import { LOCALES } from '../types/enums.ts'
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

export interface ProjectEvent {
  id: string
  locale: Locale
  /** Technologies before and after the event: a technology filter lists the project or stops listing it */
  tagIds: readonly string[]
  redirect?: boolean
}

/** Publish or unpublish of one project localization (F07-T1); the home lists featured projects */
export function projectPurgeTags(event: ProjectEvent): string[] {
  return [...new Set([
    cacheTags.projectLocale(event.id, event.locale),
    cacheTags.projectList(event.locale),
    cacheTags.page('home', event.locale),
    cacheTags.sitemap(),
    ...event.tagIds.map(cacheTags.tag),
    ...(event.redirect ? [cacheTags.redirects()] : []),
  ])]
}

/**
 * A topic or technology renamed (F11-T4): its pages, the articles and projects that show it (tagged with it), the
 * lists that show topic chips or technology names (the home follows the project lists) and the sitemap, whose topic
 * paths change with the slug
 */
export function tagPurgeTags(id: string): string[] {
  return [cacheTags.tag(id), ...LOCALES.flatMap(locale => [cacheTags.blogList(locale), cacheTags.projectList(locale)]), cacheTags.sitemap()]
}

/** A media item's alt, caption, credit, decorative flag or focal point changed (F11-T4): every page that shows it */
export function mediaPurgeTags(id: string): string[] {
  return [cacheTags.media(id)]
}

/**
 * The projects' manual order or a featured flag changed (F11-T4): they are read live from the entity, so the lists
 * and the home of every locale
 */
export function projectListPurgeTags(): string[] {
  return LOCALES.flatMap(locale => [cacheTags.projectList(locale), cacheTags.page('home', locale)])
}

/** Everything public but the content-addressed media files, which never go stale: after a deploy (F11-T4) */
export function sitePurgeTags(): string[] {
  return [cacheTags.site()]
}
