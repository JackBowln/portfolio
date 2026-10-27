// TEST_AUTH — test-only example route (PORTFOLIO_TEST_BUILD=1): checks one permission picked by the request, so
// tests/api/authz-matrix.spec.ts can walk the whole matrix until real admin routes exist
import { z } from 'zod'
import { STATEMENTS } from '#shared/auth/permissions'
import type { Resource } from '#shared/auth/permissions'

const bodySchema = z.object({
  resource: z.enum(Object.keys(STATEMENTS) as [Resource, ...Resource[]]),
  action: z.string().max(32),
})

export default defineAdminHandler({
  // Every role can read content; the permission under test is checked below
  permission: { article: ['read'] },
  handler: async (event) => {
    const { resource, action } = await readValidatedBodyStrict(event, bodySchema)
    if (!(STATEMENTS[resource] as readonly string[]).includes(action)) {
      throw createAppError('bad_request', 'Unknown action')
    }
    requirePermission(event, { [resource]: [action] })
    return { ok: true }
  },
})
