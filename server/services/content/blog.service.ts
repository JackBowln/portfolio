// The public blog (F06-T5): list pages, topic pages, the article with its topics, related articles and published
// alternates, each with the cache tags of ADR-0003 §2. null for anything not published in the locale, so the
// routes answer 404
import { BLOG_PAGE_SIZE, pageCount, RELATED_LIMIT } from '../../../shared/content/blog.ts'
import type { BlogArticle, BlogCard, BlogList, BlogTopicPage } from '../../../shared/content/blog.ts'
import { cacheTags } from '../../../shared/cache/tags.ts'
import type { PublicMediaMap } from '../../../shared/media/public.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import type { BlogListItem } from './blog.repo.ts'
import { findPublishedArticle, findTopic, listBlogPage, publishedTopics, relatedArticles, topicsIn, topicsWithArticles } from './blog.repo.ts'
import { resolveDocumentMedia, resolveMedia, resolveShareImage } from './document-media.ts'
import { listPublishedAlternates } from './localized.repo.ts'

function cards(items: BlogListItem[], media: PublicMediaMap): BlogCard[] {
  return items.map((item) => {
    const cover = item.coverMediaId ? media[item.coverMediaId] : undefined
    return {
      slug: item.slug,
      title: item.title,
      excerpt: item.excerpt,
      cover: cover?.kind === 'image' ? cover.image : null,
      readingTimeMin: item.readingTimeMin,
      firstPublishedAt: item.firstPublishedAt.toISOString(),
      publishedAt: item.publishedAt.toISOString(),
    }
  })
}

const coverIds = (items: BlogListItem[]) => items.flatMap(item => (item.coverMediaId ? [item.coverMediaId] : []))

/** A page of the blog; null for a page past the last (the first page always exists) */
export async function blogPage(db: Db, locale: Locale, page: number): Promise<BlogList | null> {
  const { items, total } = await listBlogPage(db, locale, { offset: (page - 1) * BLOG_PAGE_SIZE, limit: BLOG_PAGE_SIZE })
  const pages = pageCount(total)
  if (page > pages) {
    return null
  }
  const [media, topics] = await Promise.all([resolveMedia(db, coverIds(items), locale), topicsWithArticles(db, locale)])
  return {
    items: cards(items, media),
    page,
    pages,
    total,
    topics: topics.map(({ name, slug, count }) => ({ name, slug, count })),
    cacheTags: [cacheTags.blogList(locale), ...coverIds(items).map(cacheTags.media)],
  }
}

/** A topic's page in the locale; null when the topic has no name or no article there, or past the last page */
export async function topicPage(db: Db, locale: Locale, slug: string, page: number): Promise<BlogTopicPage | null> {
  const topic = await findTopic(db, locale, slug)
  if (!topic) {
    return null
  }
  const [{ items, total }, alternates] = await Promise.all([
    listBlogPage(db, locale, { offset: (page - 1) * BLOG_PAGE_SIZE, limit: BLOG_PAGE_SIZE, tagId: topic.id }),
    publishedTopics(db, topic.id),
  ])
  const pages = pageCount(total)
  if (total === 0 || page > pages) {
    return null
  }
  const media = await resolveMedia(db, coverIds(items), locale)
  return {
    topic: { name: topic.name, slug: topic.slug },
    alternates: alternates.map(({ locale: code, slug: topicSlug }) => ({ locale: code, slug: topicSlug })),
    items: cards(items, media),
    page,
    pages,
    total,
    topics: [],
    cacheTags: [cacheTags.tag(topic.id), cacheTags.blogList(locale), ...coverIds(items).map(cacheTags.media)],
  }
}

/** `mediaBaseUrl` makes the share image's URL absolute (the route passes the site's) */
export async function blogArticle(db: Db, locale: Locale, slug: string, mediaBaseUrl = ''): Promise<BlogArticle | null> {
  const article = await findPublishedArticle(db, locale, slug)
  if (!article) {
    return null
  }
  const { localization, entity } = article.snapshot
  const [media, topics, related, alternates, share] = await Promise.all([
    resolveDocumentMedia(db, localization.body, locale, entity.coverMediaId ? [entity.coverMediaId] : []),
    topicsIn(db, locale, entity.tagIds),
    relatedArticles(db, locale, article.articleId, RELATED_LIMIT),
    listPublishedAlternates(db, 'article', article.articleId),
    resolveShareImage(db, localization.ogImageMediaId, locale, mediaBaseUrl, localization.title),
  ])
  const relatedMedia = await resolveMedia(db, coverIds(related), locale)
  const cover = entity.coverMediaId ? media[entity.coverMediaId] : undefined
  return {
    locale,
    title: localization.title,
    excerpt: localization.excerpt,
    body: localization.body,
    media,
    cover: cover?.kind === 'image' ? cover.image : null,
    readingTimeMin: article.readingTimeMin,
    firstPublishedAt: article.firstPublishedAt.toISOString(),
    publishedAt: article.publishedAt.toISOString(),
    topics: topics.map(({ name, slug: topicSlug }) => ({ name, slug: topicSlug })),
    related: cards(related, relatedMedia),
    alternates,
    seo: { title: localization.seoTitle ?? localization.title, description: localization.seoDescription ?? localization.excerpt, noindex: localization.noindex, image: share?.image ?? null },
    cacheTags: [
      cacheTags.article(article.articleId),
      cacheTags.articleLocale(article.articleId, locale),
      // Related articles change when another article is published
      cacheTags.blogList(locale),
      ...entity.tagIds.map(cacheTags.tag),
      ...Object.keys(media).map(cacheTags.media),
      ...Object.keys(relatedMedia).map(cacheTags.media),
      ...(share ? [cacheTags.media(share.mediaId)] : []),
    ],
  }
}
