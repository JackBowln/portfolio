// Global settings (F08-T1, RF-08): read for the site (the public keys of one locale, resolved: the locale's
// translation, else pt-BR, else the default) and for the admin (every key as stored, with its version), and saved one
// key at a time. A stored value that no longer fits its schema reads as the default instead of breaking the layout
import { cacheTags } from '../../../shared/cache/tags.ts'
import { fieldSegments } from '../../../shared/content/segment-hash.ts'
import { mediaUrl } from '../../../shared/media/public.ts'
import type { PublicImage } from '../../../shared/media/public.ts'
import type { SettingUpdate } from '../../../shared/settings/input.ts'
import type { PublicSettings } from '../../../shared/settings/public.ts'
import { settingSchemas } from '../../../shared/settings/schemas.ts'
import type { SettingGlobal, SettingLocalized } from '../../../shared/settings/schemas.ts'
import { SITE_SETTING_KEYS, SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, SiteSettingKey } from '../../../shared/types/enums.ts'
import type { Db } from '../../db/client.ts'
import { createAppError } from '../../utils/errors.ts'
import { findMediaStates } from '../media/media.repo.ts'
import { resolveMedia } from '../content/document-media.ts'
import type { SettingLocalizationRow, SettingRow } from './settings.repo.ts'
import { findSettingLocalizations, findSettings, saveSettingStatements } from './settings.repo.ts'
import { approvalMeta, outdatedBySourceChange } from '../translation/state.service.ts'

const PUBLIC_KEYS = SITE_SETTING_KEYS.filter(key => settingSchemas[key].public)

function globalOf<K extends SiteSettingKey>(key: K, rows: readonly SettingRow[]): SettingGlobal<K> {
  const parsed = settingSchemas[key].global.safeParse(rows.find(row => row.key === key)?.value)
  return (parsed.success ? parsed.data : settingSchemas[key].defaults.global) as SettingGlobal<K>
}

/** The translatable part in `locale`, else pt-BR, else the default */
function localizedOf<K extends 'identity' | 'seo_defaults' | 'footer'>(key: K, rows: readonly SettingLocalizationRow[], locale: Locale): SettingLocalized<K> {
  const schema = settingSchemas[key].localized
  for (const candidate of [locale, SOURCE_LOCALE]) {
    // F09-T1: a translation that is not approved never reaches the site
    const row = rows.find(item => item.key === key && item.locale === candidate && (item.translationState === 'source' || item.translationState === 'approved'))
    const parsed = schema.safeParse(row?.value)
    if (parsed.success) {
      return parsed.data as SettingLocalized<K>
    }
  }
  return settingSchemas[key].defaults.localized as SettingLocalized<K>
}

/** The share image as og:image takes it: the largest JPEG up to 1200 px wide, as an absolute URL */
function shareImage(image: PublicImage, mediaBaseUrl: string): PublicSettings['seo']['ogImage'] {
  const variant = image.variants.filter(item => item.format === 'jpeg' && item.width <= 1200).sort((a, b) => b.width - a.width)[0]
  const url = variant ? mediaUrl(mediaBaseUrl, variant.key) : undefined
  return variant && url ? { url, width: variant.width, height: variant.height, alt: image.alt } : null
}

export async function publicSettings(db: Db, locale: Locale, mediaBaseUrl: string): Promise<PublicSettings> {
  const [rows, localized] = await Promise.all([findSettings(db, PUBLIC_KEYS), findSettingLocalizations(db, PUBLIC_KEYS, [locale, SOURCE_LOCALE])])
  const identity = globalOf('identity', rows)
  const contact = globalOf('contact', rows)
  const seo = globalOf('seo_defaults', rows)
  const footer = globalOf('footer', rows)
  const media = seo.ogImageMediaId ? await resolveMedia(db, [seo.ogImageMediaId], locale) : {}
  const ogImage = seo.ogImageMediaId ? media[seo.ogImageMediaId] : undefined
  return {
    identity: { name: identity.name, ...localizedOf('identity', localized, locale) },
    social: globalOf('social', rows).links,
    contactEmail: contact.showEmail ? contact.email : null,
    seo: { ...localizedOf('seo_defaults', localized, locale), ogImage: ogImage?.kind === 'image' ? shareImage(ogImage.image, mediaBaseUrl) : null },
    navigation: globalOf('navigation', rows).items,
    footer: { showSocial: footer.showSocial, ...localizedOf('footer', localized, locale) },
    features: globalOf('features', rows),
    cacheTags: [cacheTags.settings(), ...Object.keys(media).map(cacheTags.media)],
  }
}

/** The site's name alone (one row), for JSON-LD breadcrumbs (F11-T1) */
export async function siteName(db: Db): Promise<string> {
  return globalOf('identity', await findSettings(db, ['identity'])).name
}

/** The feature switches alone (one row), for routes that depend on them */
export async function siteFeatures(db: Db): Promise<SettingGlobal<'features'>> {
  return globalOf('features', await findSettings(db, ['features']))
}

/** The AI translation limits and model (F09-T3); never sent to the site */
export async function aiTranslationSettings(db: Db): Promise<SettingGlobal<'ai_translation'>> {
  return globalOf('ai_translation', await findSettings(db, ['ai_translation']))
}

/** Where contact notifications go (F08-T3): the address set in the settings, verified in Email Routing */
export async function contactAddress(db: Db): Promise<string | null> {
  return globalOf('contact', await findSettings(db, ['contact'])).email
}

export interface AdminSetting {
  key: SiteSettingKey
  /** 0 while the key was never saved (its value is the default) */
  version: number
  value: unknown
  /** Stored translations by locale; absent locales fall back to pt-BR */
  localizations: Partial<Record<Locale, unknown>>
  updatedAt: Date | null
}

/** Every key as the admin edits it */
export async function adminSettings(db: Db): Promise<AdminSetting[]> {
  const [rows, localized] = await Promise.all([findSettings(db, SITE_SETTING_KEYS), findSettingLocalizations(db, SITE_SETTING_KEYS)])
  return SITE_SETTING_KEYS.map((key) => {
    const row = rows.find(item => item.key === key)
    const defaults = settingSchemas[key].defaults
    const translations = Object.fromEntries(localized.filter(item => item.key === key).map(item => [item.locale, item.value]))
    return {
      key,
      version: row?.version ?? 0,
      value: globalOf(key, rows),
      localizations: defaults.localized && !translations[SOURCE_LOCALE] ? { ...translations, [SOURCE_LOCALE]: defaults.localized } : translations,
      updatedAt: row?.updatedAt ?? null,
    }
  })
}

/** Saves one key. 409 on "version" when it changed since the admin read it; 400 when the OG image is not ready */
export async function updateSetting(db: Db, userId: string, key: SiteSettingKey, input: SettingUpdate): Promise<AdminSetting> {
  if (key === 'seo_defaults') {
    const id = (input.value as SettingGlobal<'seo_defaults'>).ogImageMediaId
    const state = id ? (await findMediaStates(db, [id])).get(id) : undefined
    if (id && (state?.kind !== 'image' || state.status !== 'ready')) {
      throw createAppError('bad_request', 'Invalid input', [{ path: 'value.ogImageMediaId', message: 'must be a ready image' }])
    }
  }
  // F09-T1: only owner and admin save settings, and both may approve translations, so what they type is approved
  // against the pt-BR text it was written for; a pt-BR change makes the other approved translations outdated
  const stored = settingSchemas[key].localized ? await findSettingLocalizations(db, [key]) : []
  const before = stored.find(row => row.locale === SOURCE_LOCALE)?.value as Record<string, unknown> | undefined
  const written = input.localizations ?? {}
  const after = SOURCE_LOCALE in written ? (written[SOURCE_LOCALE] as Record<string, unknown> | null) ?? undefined : before
  const meta = await approvalMeta(fieldSegments(after))
  const localizations = Object.entries(written).map(([locale, value]) => ({
    locale: locale as Locale,
    value: value ?? null,
    state: locale === SOURCE_LOCALE ? 'source' as const : 'approved' as const,
    meta: locale === SOURCE_LOCALE ? undefined : meta,
  }))
  const untouched = stored.filter(row => row.locale !== SOURCE_LOCALE && !(row.locale in written))
    .map(row => ({ key: row.locale, translationState: row.translationState, segmentsMeta: row.segmentsMeta }))
  const outdated = (await outdatedBySourceChange(fieldSegments(before), fieldSegments(after), untouched)).map(item => ({ locale: item.key, meta: item.meta }))
  const [saved] = await db.batch(saveSettingStatements(db, { key, version: input.version, value: input.value, userId, now: new Date(), localizations, outdated }))
  if (saved.length === 0) {
    throw createAppError('conflict', 'The settings changed since they were opened', [{ path: 'version', message: 'stale' }])
  }
  return (await adminSettings(db)).find(item => item.key === key)!
}
