// Translation pending work for the dashboard (F09-T1): per entity type and locale, missing, machine, in review and
// outdated. For whoever reviews translations (decision 4)
import { translationSummary } from '../../../services/translation/state.service.ts'

export default defineAdminHandler({
  permission: { translation: ['review'] },
  handler: event => translationSummary(useDb(event)),
})
