// Global settings (F08-T1, data-model §6, RF-08): one zod schema per site_settings key, split into the global value
// (site_settings.value) and the translatable part (site_setting_localizations, per locale; a missing locale falls
// back to pt-BR, then to the default). The defaults are what the site shows with an empty database: placeholders,
// never invented content, and safe AI limits. Strict at every level, so the admin and the API apply the same rules
import { z } from 'zod'
import { AI_MODEL_IDS } from '../translation/models.ts'
import { isUuidv7 } from '../utils/id.ts'
import type { SiteSettingKey } from '../types/enums.ts'

const text = (max: number) => z.string().trim().max(max)
const required = (max: number) => z.string().trim().min(1, 'required').max(max)
const httpsUrl = z.string().trim().max(500).pipe(z.url({ protocol: /^https$/, hostname: z.regexes.domain, error: 'must be an https: link' }))
const mediaId = z.string().refine(isUuidv7, 'must be a media id')

export const SOCIAL_NETWORKS = ['github', 'linkedin', 'mastodon', 'bluesky', 'x', 'youtube', 'website'] as const
/** Pages the main navigation can show, in the order chosen (RF-08.4); their labels come from the UI messages */
export const NAVIGATION_PAGES = ['projects', 'blog', 'about', 'contact'] as const
export const AI_LOCALES = ['en', 'es', 'de', 'fr'] as const
/** Workers AI free allocation is 10,000 neurons a day (ADR-0009) */
export const NEURON_CAP_MAX = 10_000

const unique = <T extends z.ZodType>(item: T, max: number) => z.array(item).max(max)
const translationStyle = z.strictObject({ formality: z.enum(['formal', 'informal']), notes: text(500).optional() })

export const settingSchemas = {
  identity: {
    global: z.strictObject({ name: required(80) }),
    localized: z.strictObject({ role: text(120), bio: text(300) }),
    defaults: { global: { name: '[PLACEHOLDER]' }, localized: { role: '[PLACEHOLDER]', bio: '' } },
    public: true,
  },
  social: {
    global: z.strictObject({
      links: unique(z.strictObject({ network: z.enum(SOCIAL_NETWORKS), url: httpsUrl }), 10)
        .refine(links => new Set(links.map(link => link.url)).size === links.length, 'a link appears twice'),
    }),
    localized: null,
    defaults: { global: { links: [] }, localized: null },
    public: true,
  },
  contact: {
    global: z.strictObject({ email: z.email().max(254).nullable(), showEmail: z.boolean() }),
    localized: null,
    defaults: { global: { email: null, showEmail: false }, localized: null },
    public: true,
  },
  seo_defaults: {
    global: z.strictObject({ ogImageMediaId: mediaId.nullable() }),
    localized: z.strictObject({
      titleTemplate: required(120).refine(value => value.split('%s').length === 2, 'must contain %s once'),
      description: text(300),
    }),
    defaults: { global: { ogImageMediaId: null }, localized: { titleTemplate: '%s — [PLACEHOLDER]', description: '[PLACEHOLDER]' } },
    public: true,
  },
  navigation: {
    global: z.strictObject({
      items: unique(z.enum(NAVIGATION_PAGES), NAVIGATION_PAGES.length).refine(items => new Set(items).size === items.length, 'a page appears twice'),
    }),
    localized: null,
    defaults: { global: { items: [...NAVIGATION_PAGES] }, localized: null },
    public: true,
  },
  footer: {
    global: z.strictObject({ showSocial: z.boolean() }),
    localized: z.strictObject({ text: text(200) }),
    defaults: { global: { showSocial: true }, localized: { text: '' } },
    public: true,
  },
  ai_translation: {
    global: z.strictObject({
      enabled: z.boolean(),
      // 'anthropic' only after an ADR and the owner's approval (ADR-0009)
      provider: z.literal('workers-ai'),
      // Only a model with known rates (F09-T3); empty until the evaluation picks one, and the translation stays off
      model: z.union([z.enum(AI_MODEL_IDS), z.literal('')]),
      dailyNeuronCap: z.int().min(0).max(NEURON_CAP_MAX),
      monthlyBudgetMicroUsd: z.int().min(0),
      perJobMaxMicroUsd: z.int().min(0),
      // Workers AI costs no money on the Free plan, so a job is capped in neurons too (F09-T3, decision 4)
      perJobNeuronCap: z.int().min(0).max(NEURON_CAP_MAX).default(2000),
      style: z.strictObject({ en: translationStyle, es: translationStyle, de: translationStyle, fr: translationStyle }),
    }),
    localized: null,
    defaults: {
      global: {
        enabled: false,
        provider: 'workers-ai' as const,
        model: '' as const,
        dailyNeuronCap: 8000,
        monthlyBudgetMicroUsd: 0,
        perJobMaxMicroUsd: 0,
        perJobNeuronCap: 2000,
        style: { en: { formality: 'informal' as const }, es: { formality: 'informal' as const }, de: { formality: 'informal' as const }, fr: { formality: 'informal' as const } },
      },
      localized: null,
    },
    // Never leaves the admin
    public: false,
  },
  features: {
    global: z.strictObject({ contactForm: z.boolean(), rss: z.boolean() }),
    localized: null,
    defaults: { global: { contactForm: true, rss: true }, localized: null },
    public: true,
  },
} satisfies Record<SiteSettingKey, { global: z.ZodType, localized: z.ZodType | null, defaults: { global: unknown, localized: unknown }, public: boolean }>

export type SettingSchemas = typeof settingSchemas
export type SettingGlobal<K extends SiteSettingKey> = z.output<SettingSchemas[K]['global']>
export type SettingLocalized<K extends SiteSettingKey> = SettingSchemas[K]['localized'] extends z.ZodType ? z.output<SettingSchemas[K]['localized']> : null

/** Keys with a translatable part */
export const LOCALIZED_SETTING_KEYS = (Object.keys(settingSchemas) as SiteSettingKey[]).filter(key => settingSchemas[key].localized !== null)
