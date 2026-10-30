// Admin-only. Settings as the admin API returns them (F08-T1)
import type { Locale, SiteSettingKey } from '#shared/types/enums'

export interface AdminSetting<G = Record<string, unknown>, L = Record<string, string>> {
  key: SiteSettingKey
  /** 0 while the key was never saved */
  version: number
  value: G
  localizations: Partial<Record<Locale, L | null>>
  updatedAt: string | null
}

/** The error code of a failed admin request (e.g. session_not_fresh), when the server sent one */
export function apiErrorCode(error: unknown): string | undefined {
  return (error as { response?: { _data?: { data?: { code?: string } } } }).response?._data?.data?.code
}
