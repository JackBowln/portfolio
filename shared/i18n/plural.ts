// ADR-0008 §2 (option A): vue-i18n pipe plurals (`one | other`) choose their form with Intl.PluralRules, so each locale
// follows CLDR instead of vue-i18n's English-centric default (e.g. French "0 article" is singular).
// Three forms (`zero | one | other`) keep vue-i18n's convention of a dedicated zero form.
export type PluralRule = (choice: number, choicesLength: number) => number

export function createPluralRule(language: string): PluralRule {
  const rules = new Intl.PluralRules(language)
  return (choice, choicesLength) => {
    const offset = choicesLength >= 3 ? 1 : 0
    if (offset && choice === 0) {
      return 0
    }
    const index = rules.select(Math.abs(choice)) === 'one' ? 0 : 1
    return Math.min(index + offset, choicesLength - 1)
  }
}
