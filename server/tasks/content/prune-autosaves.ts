// Runs on the 5-minute cron (wrangler.jsonc triggers, nuxt.config scheduledTasks) and prunes expired autosaves of
// every content type once a day, in the 03:00 UTC window (server/services/content/prune.repo.ts). Bounded per run;
// what is left goes on the next day. Run by hand with `{ force: true }` as the payload
import { CONTENT_TYPES } from '#shared/content/snapshot'
import { createDb } from '../../db/client.ts'
import { isPruneWindow, pruneAutosaves } from '../../services/content/prune.repo.ts'

const LIMIT_PER_TYPE = 500

export default defineTask({
  meta: { name: 'content:prune-autosaves', description: 'Deletes autosave revisions past the retention' },
  async run({ context, payload }) {
    const now = new Date()
    if (!payload.force && !isPruneWindow(now)) {
      return { result: 'skipped: outside the daily window' }
    }
    const env = (context as { cloudflare?: { env?: Env } }).cloudflare?.env
    if (!env?.DB) {
      return { result: 'skipped: no D1 binding' }
    }
    const db = createDb(env.DB)
    const deleted: Record<string, number> = {}
    for (const type of CONTENT_TYPES) {
      deleted[type] = await pruneAutosaves(db, type, now, LIMIT_PER_TYPE)
    }
    logger.info('content.prune_autosaves', deleted)
    return { result: Object.entries(deleted).map(([type, count]) => `${type}: ${count}`).join(', ') }
  },
})
