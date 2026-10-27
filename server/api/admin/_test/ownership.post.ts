// TEST_AUTH — test-only example route (PORTFOLIO_TEST_BUILD=1): assertOwnership on an item described by the request
import { z } from 'zod'
import { PUBLICATION_STATUSES } from '#shared/types/enums'

const bodySchema = z.object({
  action: z.enum(['update', 'delete', 'restore']),
  authorId: z.string().max(64).nullable(),
  status: z.enum(PUBLICATION_STATUSES),
})

export default defineAdminHandler({
  permission: { article: ['read'] },
  handler: async (event) => {
    const { action, ...article } = await readValidatedBodyStrict(event, bodySchema)
    assertOwnership(event, { article: [action] }, article)
    return { ok: true }
  },
})
