// vue-i18n options for @nuxtjs/i18n (ADR-0008 §2); messages live in i18n/locales/*.json
import { LOCALES } from '#shared/types/enums'
import { createPluralRule } from '#shared/i18n/plural'

export default defineI18nConfig(() => ({
  fallbackLocale: 'pt-BR',
  pluralRules: Object.fromEntries(LOCALES.map(locale => [locale, createPluralRule(locale)])),
}))
