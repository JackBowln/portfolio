// Answers an RSS request (F06-T5): the feed, cached and tagged rss:{l}
import type { H3Event } from 'h3'
import { cacheTags } from '#shared/cache/tags'
import type { Locale } from '#shared/types/enums'
import { rssFeed } from '../services/content/feeds.ts'

export async function sendRss(event: H3Event, locale: Locale): Promise<string> {
  const xml = await rssFeed(useDb(event), useEnv(event).SITE_URL, locale)
  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  setCachePolicy(event, 'public')
  setCacheTags(event, [cacheTags.rss(locale)])
  return xml
}
