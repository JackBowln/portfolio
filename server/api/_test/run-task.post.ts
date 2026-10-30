// Test-only (PORTFOLIO_TEST_BUILD=1): runs the schedule cron's work with a given clock, so E2E can move time past
// a scheduled publication (F06-T4, J-04). Purges like the task. `articleIds` keeps a test's moved clock away from
// the other tests' schedules, which run in parallel
import { z } from 'zod'
import { publishDue } from '../../services/content/publishing.service.ts'

const bodySchema = z.object({ now: z.iso.datetime({ offset: true }), articleIds: z.array(z.string().max(64)).min(1).max(20) })

export default defineEventHandler(async (event) => {
  const { now, articleIds } = await readValidatedBodyStrict(event, bodySchema)
  const result = await publishDue(useDb(event), new Date(now), undefined, articleIds)
  await purgeCacheTags(event, result.purge).catch(() => {})
  return result
})
