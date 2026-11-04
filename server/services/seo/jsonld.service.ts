// JSON-LD per template (F11-T1, i18n-seo §5), built on the server from what the response already holds and sent as
// a ready string: the pages only put it in <head>. Each template gets only its types, with visible content
import { articlePath, projectPath, topicPath } from '../../../shared/content/paths.ts'
import type { BlogArticle, BlogTopic } from '../../../shared/content/blog.ts'
import type { PublicProject } from '../../../shared/content/projects-public.ts'
import { localizedPath } from '../../../shared/i18n/locales.ts'
import { STATIC_PAGE_PATHS } from '../../../shared/i18n/routes.ts'
import type { StaticPage } from '../../../shared/i18n/routes.ts'
import { shareImage } from '../../../shared/media/public.ts'
import type { PublicImage } from '../../../shared/media/public.ts'
import { blogPosting, breadcrumbList, collectionPage, creativeWork, person, profilePage, serializeJsonLd, website } from '../../../shared/seo/jsonld.ts'
import { SECTION_NAMES } from '../../../shared/seo/sections.ts'
import type { PublicSettings } from '../../../shared/settings/public.ts'
import type { Locale } from '../../../shared/types/enums.ts'

export interface SeoContext {
  siteUrl: string
  mediaBaseUrl: string
}

const absolute = (context: SeoContext, path: string) => `${context.siteUrl.replace(/\/$/, '')}${path}`
const staticUrl = (context: SeoContext, page: StaticPage, locale: Locale) => absolute(context, localizedPath(locale, STATIC_PAGE_PATHS[page][locale]))

/** The largest JPEG up to 1200 px wide, as og:image takes it */
function imageUrl(context: SeoContext, image: PublicImage | null | undefined): string | undefined {
  return image ? shareImage(image, context.mediaBaseUrl)?.url : undefined
}

const home = (context: SeoContext, locale: Locale, name: string) => ({ name, url: staticUrl(context, 'home', locale) })

// The social links only when the footer shows them: JSON-LD describes what is visible
const owner = (context: SeoContext, settings: PublicSettings) => person({
  siteUrl: context.siteUrl,
  name: settings.identity.name,
  jobTitle: settings.identity.role || undefined,
  sameAs: settings.footer.showSocial ? settings.social.map(link => link.url) : undefined,
})

export function homeJsonLd(context: SeoContext, locale: Locale, settings: PublicSettings): string {
  return serializeJsonLd([website({ siteUrl: context.siteUrl, name: settings.identity.name, locale }), owner(context, settings)])
}

export function aboutJsonLd(context: SeoContext, locale: Locale, settings: PublicSettings, dateModified: string | undefined): string {
  return serializeJsonLd([
    profilePage({ url: staticUrl(context, 'about', locale), name: SECTION_NAMES.about[locale], locale, siteUrl: context.siteUrl, dateModified }),
    owner(context, settings),
  ])
}

export function articleJsonLd(context: SeoContext, article: BlogArticle, siteName: string): string {
  const slug = article.alternates.find(item => item.locale === article.locale)?.slug ?? ''
  const url = absolute(context, articlePath(article.locale, slug))
  return serializeJsonLd([
    blogPosting({
      url,
      headline: article.title,
      description: article.excerpt || undefined,
      locale: article.locale,
      siteUrl: context.siteUrl,
      datePublished: article.firstPublishedAt,
      dateModified: article.publishedAt,
      image: imageUrl(context, article.cover) ?? article.seo.image?.url,
      keywords: article.topics.map(topic => topic.name),
    }),
    breadcrumbList({ url, items: [home(context, article.locale, siteName), { name: SECTION_NAMES.blog[article.locale], url: staticUrl(context, 'blog', article.locale) }, { name: article.title, url }] }),
  ])
}

export function projectJsonLd(context: SeoContext, project: PublicProject, siteName: string): string {
  const slug = project.alternates.find(item => item.locale === project.locale)?.slug ?? ''
  const url = absolute(context, projectPath(project.locale, slug))
  return serializeJsonLd([
    creativeWork({
      url,
      name: project.title,
      description: project.summary || undefined,
      locale: project.locale,
      siteUrl: context.siteUrl,
      image: imageUrl(context, project.cover) ?? project.seo.image?.url,
      keywords: project.technologies.map(technology => technology.name),
      codeRepository: project.repoUrl,
    }),
    breadcrumbList({ url, items: [home(context, project.locale, siteName), { name: SECTION_NAMES.projects[project.locale], url: staticUrl(context, 'projects', project.locale) }, { name: project.title, url }] }),
  ])
}

/** A blog page of the list (page > 1 has its own URL), or a topic's */
export function blogListJsonLd(context: SeoContext, locale: Locale, siteName: string, page: number, topic?: BlogTopic | undefined): string {
  const blog = { name: SECTION_NAMES.blog[locale], url: staticUrl(context, 'blog', locale) }
  const first = topic ? absolute(context, topicPath(locale, topic.slug)) : blog.url
  const url = page > 1 ? `${first}?page=${page}` : first
  const name = topic ? topic.name : blog.name
  return serializeJsonLd([
    collectionPage({ url, name, locale, siteUrl: context.siteUrl }),
    breadcrumbList({ url, items: [home(context, locale, siteName), blog, ...(topic ? [{ name: topic.name, url: first }] : [])] }),
  ])
}

export function projectListJsonLd(context: SeoContext, locale: Locale, siteName: string): string {
  const url = staticUrl(context, 'projects', locale)
  const name = SECTION_NAMES.projects[locale]
  return serializeJsonLd([
    collectionPage({ url, name, locale, siteUrl: context.siteUrl }),
    breadcrumbList({ url, items: [home(context, locale, siteName), { name, url }] }),
  ])
}
