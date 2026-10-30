// Runs on the 5-minute cron (F06-T4): publishes the scheduled localizations whose time has come, a few per run,
// then purges their tags. Idempotent: a localization publishes only while still scheduled
import { createDb } from '../../db/client.ts'
import { publishDue } from '../../services/content/publishing.service.ts'

export default defineTask({
  meta: { name: 'content:publish-due', description: 'Publishes scheduled localizations that are due' },
  async run({ context }) {
    const cloudflare = (context as { cloudflare?: { env?: Env, context?: ExecutionContext } }).cloudflare
    if (!cloudflare?.env?.DB) {
      return { result: 'skipped: no D1 binding' }
    }
    const result = await publishDue(createDb(cloudflare.env.DB), new Date())
    if (result.purge.length > 0) {
      await purgeCacheTagsIn(cloudflare.context, result.purge).catch(() => {})
    }
    logger.info('content.publish_due', { published: result.published, failed: result.failed })
    return { result: `published: ${result.published}, failed: ${result.failed}` }
  },
})
