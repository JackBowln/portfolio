// What the admin sends to save one settings key (F08-T1): the version it read (0 before the key was ever saved),
// the global value, and for translatable keys the locales to write (null removes a translation, so it falls back to
// pt-BR again; pt-BR itself cannot be removed)
import { z } from 'zod'
import { LOCALES, SOURCE_LOCALE } from '../types/enums.ts'
import type { SiteSettingKey } from '../types/enums.ts'
import { settingSchemas } from './schemas.ts'

export function settingUpdateSchema(key: SiteSettingKey) {
  const { global, localized } = settingSchemas[key]
  return z.strictObject({
    version: z.int().min(0),
    value: global,
    ...(localized
      ? {
          localizations: z.partialRecord(z.enum(LOCALES), (localized as z.ZodType).nullable()).optional()
            .refine(values => values?.[SOURCE_LOCALE] !== null, 'pt-BR cannot be removed'),
        }
      : {}),
  })
}

/** A save once validated by its key's schema */
export interface SettingUpdate {
  version: number
  value: unknown
  localizations?: Partial<Record<string, unknown>> | undefined
}
