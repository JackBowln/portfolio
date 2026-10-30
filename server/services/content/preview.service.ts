// What a preview link shows (F06-T3): the working copy of one localization, never a published snapshot, with its
// media resolved like a public page. null for anything that does not exist any more, so the route answers the same
// 404 as for a bad token
import type { ArticlePreview } from '../../../shared/content/preview.ts'
import type { Db } from '../../db/client.ts'
import type { PreviewClaims } from '../../utils/preview-token.ts'
import { findArticle } from './articles.repo.ts'
import { findLocalizations } from './working-copy.repo.ts'
import { resolveDocumentMedia } from './document-media.ts'

export async function articlePreview(db: Db, claims: PreviewClaims): Promise<ArticlePreview | null> {
  const article = await findArticle(db, claims.id)
  if (!article) {
    return null
  }
  const [copy] = (await findLocalizations(db, 'article', [article.id])).filter(item => item.locale === claims.locale)
  if (!copy) {
    return null
  }
  const media = await resolveDocumentMedia(db, copy.body, claims.locale, article.coverMediaId ? [article.coverMediaId] : [])
  const cover = article.coverMediaId ? media[article.coverMediaId] : undefined
  return {
    locale: claims.locale,
    title: copy.title,
    excerpt: copy.excerpt,
    body: copy.body,
    readingTimeMin: copy.readingTimeMin,
    cover: cover?.kind === 'image' ? cover.image : null,
    media,
    expiresAt: claims.expiresAt,
  }
}
