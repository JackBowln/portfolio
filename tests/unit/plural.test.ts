import { describe, expect, it } from 'vitest'
import { createPluralRule } from '../../shared/i18n/plural'

describe('createPluralRule', () => {
  it('follows CLDR per language for two forms (one | other)', () => {
    const en = createPluralRule('en')
    const fr = createPluralRule('fr')
    const ptBR = createPluralRule('pt-BR')

    expect([0, 1, 2].map(n => en(n, 2))).toEqual([1, 0, 1])
    // French and Brazilian Portuguese treat 0 as singular
    expect([0, 1, 2].map(n => fr(n, 2))).toEqual([0, 0, 1])
    expect([0, 1, 2].map(n => ptBR(n, 2))).toEqual([0, 0, 1])
  })

  it('keeps the dedicated zero form when there are three forms (zero | one | other)', () => {
    const de = createPluralRule('de')

    expect([0, 1, 2, 5].map(n => de(n, 3))).toEqual([0, 1, 2, 2])
  })

  it('never returns an index past the available forms', () => {
    expect(createPluralRule('es')(1_000_000, 1)).toBe(0)
  })
})
