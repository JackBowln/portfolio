import { describe, expect, it } from 'vitest'
import { compareMessages } from '../../scripts/i18n/compare'
import type { Messages } from '../../scripts/i18n/compare'

const source: Messages = {
  layout: { nav: { label: 'Navegação', blog: 'Blog' } },
  common: { sampleDate: 'Data: {date}', articles: 'um artigo | {count} artigos' },
}

const kinds = (target: Messages, optional: string[] = []) =>
  compareMessages(source, target, 'de', optional).map(issue => `${issue.kind}:${issue.key}`)

describe('compareMessages', () => {
  it('accepts a locale that mirrors the source', () => {
    expect(kinds({
      layout: { nav: { label: 'Navigation', blog: 'Blog' } },
      common: { sampleDate: 'Datum: {date}', articles: 'ein Artikel | {count} Artikel' },
    })).toEqual([])
  })

  it('reports missing and orphan keys, only at the top of a subtree', () => {
    expect(kinds({
      common: { sampleDate: 'Datum: {date}', articles: 'ein Artikel | {count} Artikel', extra: 'x' },
    })).toEqual(['missing:layout', 'orphan:common.extra'])
  })

  it('reports a message where the source has a group, and the reverse', () => {
    expect(kinds({
      layout: 'Layout',
      common: { sampleDate: { short: 'x' }, articles: 'ein Artikel | {count} Artikel' },
    })).toEqual(['type:layout', 'type:common.sampleDate'])
  })

  it('reports empty messages, changed placeholders and plural forms', () => {
    expect(kinds({
      layout: { nav: { label: ' ', blog: 'Blog' } },
      common: { sampleDate: 'Datum: {day}', articles: '{count} Artikel' },
    })).toEqual(['empty:layout.nav.label', 'placeholders:common.sampleDate', 'plural-forms:common.articles'])
  })

  it('lets optional prefixes be missing but still reports their orphans', () => {
    const adminSource: Messages = { ...source, admin: { save: 'Salvar' } }
    const target: Messages = {
      layout: { nav: { label: 'Navigation', blog: 'Blog' } },
      common: { sampleDate: 'Datum: {date}', articles: 'ein Artikel | {count} Artikel' },
    }

    expect(compareMessages(adminSource, target, 'de', ['admin'])).toEqual([])
    expect(compareMessages(source, { ...target, admin: { save: 'Speichern' } }, 'de', ['admin']))
      .toEqual([{ locale: 'de', key: 'admin', kind: 'orphan' }])
  })
})
