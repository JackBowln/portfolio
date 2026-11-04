// AI usage for the dashboard (F09-T3): today's neurons (UTC day) against the cap, and this month's
import { translationUsage } from '../../../services/translation/run.service.ts'

export default defineAdminHandler({
  permission: { translation: ['review'] },
  handler: event => translationUsage(useDb(event)),
})
