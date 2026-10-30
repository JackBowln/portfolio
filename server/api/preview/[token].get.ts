// What /preview/[token] renders (F06-T3): public (whoever has the link), never cached nor indexed (routeRules),
// and one indistinct 404 for a malformed, tampered, expired or foreign token or a deleted article
import { z } from 'zod'
import { articlePreview } from '../../services/content/preview.service.ts'
import { resolvePreviewSecret, verifyPreviewToken } from '../../utils/preview-token.ts'

const paramsSchema = z.object({ token: z.string().min(1).max(512) })

export default defineEventHandler(async (event) => {
  const params = paramsSchema.safeParse(getRouterParams(event, { decode: true }))
  const claims = params.success ? await verifyPreviewToken(resolvePreviewSecret(useEnv(event)), params.data.token) : null
  const preview = claims ? await articlePreview(useDb(event), claims) : null
  if (!preview) {
    throw createAppError('not_found')
  }
  return preview
})
