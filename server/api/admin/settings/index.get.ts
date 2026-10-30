// Every settings key as the admin edits it (F08-T1), with its version; ai_translation included (settings:read)
import { adminSettings } from '../../../services/settings/settings.service.ts'

export default defineAdminHandler({
  permission: { settings: ['read'] },
  handler: async event => ({ items: await adminSettings(useDb(event)) }),
})
