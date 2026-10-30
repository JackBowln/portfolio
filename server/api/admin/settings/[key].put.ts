// Saves one settings key (F08-T1, RF-08): owner and admin only (settings:update), the version read (409 when it
// changed), strict input per key, audited with the key and locales only (no values), then the `settings` purge.
// ai_translation decides what the site spends, so it also needs a fresh session (RF-08.6)
import { z } from 'zod'
import { settingUpdateSchema } from '#shared/settings/input'
import type { SettingUpdate } from '#shared/settings/input'
import { SITE_SETTING_KEYS } from '#shared/types/enums'
import { cacheTags } from '#shared/cache/tags'
import { updateSetting } from '../../../services/settings/settings.service.ts'

const paramsSchema = z.object({ key: z.enum(SITE_SETTING_KEYS) })

export default defineAdminHandler({
  permission: { settings: ['update'] },
  handler: async (event, auth) => {
    const { key } = getValidatedParamsStrict(event, paramsSchema)
    if (key === 'ai_translation') {
      requireFreshSession(event)
    }
    // Validated by the key's own schema; the service takes any key's shape
    const input = await readValidatedBodyStrict(event, settingUpdateSchema(key)) as SettingUpdate
    const setting = await updateSetting(useDb(event), auth.user.id, key, input)
    await auditRequest(event, { action: 'settings.updated', entityType: 'settings', entityId: key, metadata: { version: setting.version, locales: Object.keys(input.localizations ?? {}).join(',') } })
    await purgeAfterWrite(event, [cacheTags.settings()])
    return setting
  },
})
