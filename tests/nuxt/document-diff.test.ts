// F06-T2: the browser-side diff between two versions of an article: changed fields, and body blocks matched by id
// (added, removed, changed, moved, same) with a word diff inside changed blocks
import { describe, expect, it } from 'vitest'
import type { BlockNode, DocumentJson } from '#shared/content/document-schema'
import { blockText, diffBlocks, diffFields, diffVersions } from '~/utils/admin/document-diff'
import type { VersionFields } from '~/utils/admin/document-diff'
import { fullDocument } from '../support/documents'

const para = (id: string, text: string): BlockNode => ({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text }] })
const doc = (...content: BlockNode[]): DocumentJson => ({ type: 'doc', content })
const fields = (overrides: Partial<VersionFields> = {}): VersionFields => ({
  title: 'Título',
  slug: 'titulo',
  excerpt: '',
  seoTitle: null,
  seoDescription: null,
  ogImageMediaId: null,
  noindex: false,
  coverMediaId: null,
  tagIds: [],
  body: doc(),
  ...overrides,
})

describe('document diff', () => {
  it('matches blocks by id: added, removed, changed, moved and same', () => {
    const before = doc(para('a', 'Primeiro'), para('b', 'Segundo bloco'), para('c', 'Terceiro'), para('d', 'Quarto'))
    const after = doc(para('c', 'Terceiro'), para('a', 'Primeiro'), para('b', 'Segundo bloco editado'), para('e', 'Novo'))
    const blocks = diffBlocks(before, after)
    expect(blocks.map(block => [block.id, block.status])).toEqual([
      ['c', 'moved'],
      ['a', 'same'],
      ['b', 'changed'],
      ['d', 'removed'],
      ['e', 'added'],
    ])
    const changed = blocks.find(block => block.id === 'b')!
    expect(changed.words?.filter(part => part.added).map(part => part.value.trim())).toEqual(['editado'])
    expect(changed.words?.filter(part => part.removed)).toEqual([])
  })

  it('counts an attribute change as a change even with the same text', () => {
    const before = doc({ type: 'heading', attrs: { id: 'h', level: 2 }, content: [{ type: 'text', text: 'Título' }] })
    const after = doc({ type: 'heading', attrs: { id: 'h', level: 3 }, content: [{ type: 'text', text: 'Título' }] })
    expect(diffBlocks(before, after)).toEqual([{ id: 'h', type: 'heading', status: 'changed', before: 'Título', after: 'Título', words: null }])
  })

  it('reads text from every block type', () => {
    const texts = fullDocument().content.map(blockText)
    expect(texts).toContain('Introdução')
    expect(texts.some(text => text.includes('const answer = 42'))).toBe(true)
    expect(texts).toContain('Palestra sobre acessibilidade')
    expect(texts.some(text => text.includes('Um\nDois\nTrês'))).toBe(true)
    expect(texts).toContain('Coluna\nValor')
  })

  it('lists changed fields and reports identical versions', () => {
    const before = fields({ tagIds: ['t1'] })
    expect(diffFields(before, fields({ tagIds: ['t1'] }))).toEqual([])
    expect(diffFields(before, fields({ title: 'Outro', tagIds: ['t2'], seoTitle: null, noindex: true })).map(change => change.field)).toEqual(['title', 'noindex', 'tagIds'])
    const body = fullDocument()
    expect(diffVersions(fields({ body }), fields({ body: JSON.parse(JSON.stringify(body)) as DocumentJson })).identical).toBe(true)
    expect(diffVersions(fields(), fields({ excerpt: 'x' })).identical).toBe(false)
  })
})
