// The RSS feed of a locale (F06-T5, i18n-seo §6): the 20 newest articles published in it, titled from the locale's
// messages. The routes cache it tagged rss:{l}, which publishing purges
import { RSS_ITEMS } from '../../../shared/content/blog.ts'
import { articlePath } from '../../../shared/content/paths.ts'
import { localizedPath } from '../../../shared/i18n/locales.ts'
import { absoluteUrl } from '../../../shared/seo/head.ts'
import { buildRss } from '../../../shared/seo/rss.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import de from '../../../i18n/locales/de.json'
import en from '../../../i18n/locales/en.json'
import es from '../../../i18n/locales/es.json'
import fr from '../../../i18n/locales/fr.json'
import ptBR from '../../../i18n/locales/pt-BR.json'
import type { Db } from '../../db/client.ts'
import { listBlogPage } from './blog.repo.ts'

const MESSAGES: Record<Locale, { blog: { rssTitle: string, rssDescription: string } }> = { 'pt-BR': ptBR, en, es, de, fr }

export async function rssFeed(db: Db, siteUrl: string, locale: Locale): Promise<string> {
  const { items } = await listBlogPage(db, locale, { offset: 0, limit: RSS_ITEMS })
  return buildRss({
    title: MESSAGES[locale].blog.rssTitle,
    description: MESSAGES[locale].blog.rssDescription,
    link: absoluteUrl(siteUrl, localizedPath(locale, '/blog')),
    self: absoluteUrl(siteUrl, localizedPath(locale, '/rss.xml')),
    language: locale,
    items: items.map(item => ({ title: item.title, url: absoluteUrl(siteUrl, articlePath(locale, item.slug)), description: item.excerpt, publishedAt: item.firstPublishedAt })),
  })
}
