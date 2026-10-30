// Answers an RSS request (F06-T5): the feed, cached and tagged rss:{l} and `settings`, since the RSS switch of the
// feature settings (F08-T1) turns it into a 404
import type { H3Event } from 'h3'
import { cacheTags } from '#shared/cache/tags'
import type { Locale } from '#shared/types/enums'
import { rssFeed } from '../services/content/feeds.ts'
import { siteFeatures } from '../services/settings/settings.service.ts'

export async function sendRss(event: H3Event, locale: Locale): Promise<string> {
  const db = useDb(event)
  if (!(await siteFeatures(db)).rss) {
    throw createAppError('not_found')
  }
  const xml = await rssFeed(db, useEnv(event).SITE_URL, locale)
  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  setCachePolicy(event, 'public')
  setCacheTags(event, [cacheTags.rss(locale), cacheTags.settings()])
  return xml
}
