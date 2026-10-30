// F06-T1: slugs in the five languages (ADR-0008 §3): German umlauts and ß as their two-letter forms, the other
// accents dropped, anything else a single "-", and a long title cut at a word
import { describe, expect, it } from 'vitest'
import { MAX_SLUG_LENGTH, SLUG_PATTERN, slugify } from '../../shared/utils/slugify'

describe('slugify', () => {
  it.each([
    // pt-BR
    ['Ação e reação: o que muda?', 'acao-e-reacao-o-que-muda'],
    ['Programação em Nuxt 4', 'programacao-em-nuxt-4'],
    ['Pão, coração & órgão', 'pao-coracao-orgao'],
    // es
    ['¿Cómo diseñar una API?', 'como-disenar-una-api'],
    ['Año nuevo, señal ñandú', 'ano-nuevo-senal-nandu'],
    // de
    ['Größe und Übung', 'groesse-und-uebung'],
    ['Straße, Äpfel, Öl', 'strasse-aepfel-oel'],
    ['GROSSE ÄNDERUNG', 'grosse-aenderung'],
    // fr
    ['Œuvre complète : l’été à Noël', 'oeuvre-complete-l-ete-a-noel'],
    ['Ça va très bien, garçon', 'ca-va-tres-bien-garcon'],
    ['Cæsar façade', 'caesar-facade'],
    // en and symbols
    ['Hello, World! 2026', 'hello-world-2026'],
    ['  --Já--  ', 'ja'],
    ['C++ & C#', 'c-c'],
    ['snake_case_title', 'snake-case-title'],
  ])('%j → %j', (title, slug) => {
    expect(slugify(title)).toBe(slug)
    expect(slug).toMatch(SLUG_PATTERN)
  })

  it('returns an empty string when no letter or digit is left, for the caller to handle', () => {
    for (const title of ['', '   ', '!!!', '日本語', '🎉']) {
      expect(slugify(title)).toBe('')
    }
  })

  it('cuts a long title at a word boundary, never ending in "-"', () => {
    const slug = slugify('uma frase bastante longa '.repeat(10))
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH)
    expect(slug).toMatch(SLUG_PATTERN)
    expect(slug.endsWith('longa') || slug.endsWith('frase') || slug.endsWith('bastante') || slug.endsWith('uma')).toBe(true)
    expect(slugify('a'.repeat(200))).toBe('a'.repeat(MAX_SLUG_LENGTH))
  })
})
