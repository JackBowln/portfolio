// Runs on the 5-minute cron (wrangler.jsonc triggers, nuxt.config scheduledTasks) and deletes contact messages older
// than 12 months once a day, in the 03:00 UTC window shared with the autosave prune (F08-T3, data-model §6). Bounded
// per run; what is left goes on the next day. Run by hand with `{ force: true }` as the payload
import { createDb } from '../../db/client.ts'
import { pruneContactMessages } from '../../services/contact/contact.service.ts'
import { isPruneWindow } from '../../services/content/prune.repo.ts'

const LIMIT = 1000

export default defineTask({
  meta: { name: 'contact:retention', description: 'Deletes contact messages past the 12-month retention' },
  async run({ context, payload }) {
    const now = new Date()
    if (!payload.force && !isPruneWindow(now)) {
      return { result: 'skipped: outside the daily window' }
    }
    const env = (context as { cloudflare?: { env?: Env } }).cloudflare?.env
    if (!env?.DB) {
      return { result: 'skipped: no D1 binding' }
    }
    const deleted = await pruneContactMessages(createDb(env.DB), now, LIMIT)
    logger.info('contact.retention', { deleted })
    return { result: `deleted: ${deleted}` }
  },
})
