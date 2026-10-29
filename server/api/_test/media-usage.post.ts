// Test-only (PORTFOLIO_TEST_BUILD=1): records a use of a media item, so the API tests can check that deleting
// media in use is refused. Content (F05+) records real uses
import { z } from 'zod'
import { LOCALES, MEDIA_USAGE_CONTEXTS } from '#shared/types/enums'
import { insertUsage } from '../../services/media/media.repo.ts'

const bodySchema = z.object({
  mediaId: z.string().min(1).max(64),
  entityType: z.string().min(1).max(32),
  entityId: z.string().min(1).max(64),
  locale: z.enum(LOCALES).nullable().default(null),
  context: z.enum(MEDIA_USAGE_CONTEXTS),
})

export default defineEventHandler(async (event) => {
  const usage = await readValidatedBodyStrict(event, bodySchema)
  await insertUsage(useDb(event), usage)
  return { ok: true }
})
