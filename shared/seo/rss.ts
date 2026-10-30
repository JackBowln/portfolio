// RSS 2.0 per locale (ADR-0008, i18n-seo §6, F06-T5): the 20 newest articles of the locale, with an atom:link to
// the feed itself. Text is escaped; dates are RFC 822 in GMT, as RSS requires
import { escapeXml } from './xml.ts'

export interface RssItem {
  title: string
  /** Absolute URL; also the guid */
  url: string
  description: string
  publishedAt: Date
}

export interface RssChannel {
  title: string
  description: string
  /** Absolute URL of the blog in the locale */
  link: string
  /** Absolute URL of this feed */
  self: string
  /** BCP 47 code */
  language: string
  items: readonly RssItem[]
}

/** "Fri, 30 Oct 2026 12:00:00 GMT" */
export function rfc822(date: Date): string {
  return date.toUTCString()
}

export function buildRss(channel: RssChannel): string {
  const items = channel.items.map(item => [
    '    <item>',
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(item.url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(item.url)}</guid>`,
    `      <description>${escapeXml(item.description)}</description>`,
    `      <pubDate>${rfc822(item.publishedAt)}</pubDate>`,
    '    </item>',
  ].join('\n'))
  const lastBuild = channel.items[0]?.publishedAt
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${escapeXml(channel.language)}</language>`,
    `    <atom:link href="${escapeXml(channel.self)}" rel="self" type="application/rss+xml"/>`,
    ...(lastBuild ? [`    <lastBuildDate>${rfc822(lastBuild)}</lastBuildDate>`] : []),
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
