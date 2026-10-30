// F08-T1: one schema per settings key. Every default passes its schema, the public defaults (zod-free, for the site)
// mirror them, the AI translation defaults are the safe ones, and the inputs are strict (https: links, %s once, a
// fixed provider, the neuron cap within the free allocation)
import { describe, expect, it } from 'vitest'
import { settingUpdateSchema } from '../../shared/settings/input'
import { PUBLIC_SETTINGS_DEFAULTS } from '../../shared/settings/public'
import { NEURON_CAP_MAX, settingSchemas } from '../../shared/settings/schemas'
import { SITE_SETTING_KEYS } from '../../shared/types/enums'

const parse = (key: (typeof SITE_SETTING_KEYS)[number], value: unknown) => settingSchemas[key].global.safeParse(value).success

describe('settings schemas', () => {
  it('every key has a schema whose defaults pass it', () => {
    for (const key of SITE_SETTING_KEYS) {
      const { global, localized, defaults } = settingSchemas[key]
      expect(global.safeParse(defaults.global).success, key).toBe(true)
      if (localized) {
        expect(localized.safeParse(defaults.localized).success, key).toBe(true)
      }
    }
  })

  it('the public defaults mirror the schema defaults', () => {
    const { identity, seo_defaults: seo, navigation, footer, features, social, contact } = settingSchemas
    expect(PUBLIC_SETTINGS_DEFAULTS).toEqual({
      identity: { ...identity.defaults.global, ...identity.defaults.localized },
      social: social.defaults.global.links,
      contactEmail: contact.defaults.global.showEmail ? contact.defaults.global.email : null,
      seo: { ...seo.defaults.localized, ogImage: null },
      navigation: navigation.defaults.global.items,
      footer: { ...footer.defaults.global, ...footer.defaults.localized },
      features: features.defaults.global,
      cacheTags: [],
    })
  })

  it('AI translation defaults are safe, the provider is fixed and the cap stays in the free allocation', () => {
    expect(settingSchemas.ai_translation.defaults.global).toMatchObject({ enabled: false, provider: 'workers-ai', dailyNeuronCap: 8000, monthlyBudgetMicroUsd: 0 })
    expect(settingSchemas.ai_translation.public).toBe(false)
    const valid = settingSchemas.ai_translation.defaults.global
    expect(parse('ai_translation', { ...valid, provider: 'anthropic' })).toBe(false)
    expect(parse('ai_translation', { ...valid, dailyNeuronCap: NEURON_CAP_MAX + 1 })).toBe(false)
    expect(parse('ai_translation', { ...valid, monthlyBudgetMicroUsd: -1 })).toBe(false)
    expect(parse('ai_translation', { ...valid, style: { ...valid.style, it: { formality: 'formal' } } })).toBe(false)
  })

  it('checks links, e-mail, the title template and the navigation', () => {
    expect(parse('social', { links: [{ network: 'github', url: 'https://github.com/x' }] })).toBe(true)
    for (const url of ['http://github.com/x', 'javascript:alert(1)', 'github.com/x']) {
      expect(parse('social', { links: [{ network: 'github', url }] }), url).toBe(false)
    }
    expect(parse('social', { links: [{ network: 'myspace', url: 'https://x.com' }] })).toBe(false)
    expect(parse('contact', { email: 'not-an-email', showEmail: true })).toBe(false)
    const template = (value: string) => settingSchemas.seo_defaults.localized.safeParse({ titleTemplate: value, description: '' }).success
    expect([template('%s — Nome'), template('Nome'), template('%s %s')]).toEqual([true, false, false])
    expect(parse('navigation', { items: ['blog', 'blog'] })).toBe(false)
    expect(parse('navigation', { items: ['admin'] })).toBe(false)
  })

  it('the save body is strict and keeps pt-BR', () => {
    const schema = settingUpdateSchema('footer')
    expect(schema.safeParse({ version: 0, value: { showSocial: true }, localizations: { en: { text: 'Hi' }, de: null } }).success).toBe(true)
    expect(schema.safeParse({ version: 0, value: { showSocial: true }, localizations: { 'pt-BR': null } }).success).toBe(false)
    expect(schema.safeParse({ version: 0, value: { showSocial: true }, extra: 1 }).success).toBe(false)
    expect(settingUpdateSchema('features').safeParse({ version: 1, value: { contactForm: true, rss: true }, localizations: {} }).success).toBe(false)
  })
})
