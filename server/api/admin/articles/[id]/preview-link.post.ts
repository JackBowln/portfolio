// A signed preview link for the pt-BR working copy (F06-T3), valid for 1 to 24 h. Sharing a draft outside the admin
// is an edit-level act (decision 1): article:update, an author only for their own articles. Audited
import { z } from 'zod'
import { previewLinkSchema } from '#shared/content/article-input'
import { SOURCE_LOCALE } from '#shared/types/enums'
import { getArticle } from '../../../../services/content/articles.service.ts'
import { createPreviewToken, resolvePreviewSecret } from '../../../../utils/preview-token.ts'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

export default defineAdminHandler({
  permission: { article: ['update'] },
  handler: async (event) => {
    const { id } = getValidatedParamsStrict(event, paramsSchema)
    const { hours } = await readValidatedBodyStrict(event, previewLinkSchema)
    const article = await getArticle(useDb(event), id)
    assertOwnership(event, { article: ['update'] }, { authorId: article.authorId })
    const env = useEnv(event)
    const { token, expiresAt } = await createPreviewToken(resolvePreviewSecret(env), { kind: 'article', id, locale: SOURCE_LOCALE }, hours)
    await auditRequest(event, { action: 'article.preview_link_created', entityType: 'article', entityId: id, metadata: { hours } })
    return { url: new URL(`/preview/${token}`, env.SITE_URL).toString(), expiresAt: new Date(expiresAt * 1000).toISOString() }
  },
})
