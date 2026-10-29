// F05-T2: what the server derives from a document (data-model §4.2, ADR-0009 §3, §7): deterministic, code never
// counted nor sent for translation, stable ids in the table of contents and one hash per segment
import { describe, expect, it } from 'vitest'
import { countWords, deriveDocument, readingTimeMin, segmentHashes, segmentSources } from '../../shared/content/derive'
import type { DocumentJson } from '../../shared/content/document-schema'
import { MEDIA, fullDocument } from '../support/documents'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any -- documents are edited by hand

const reorderKeys = (value: unknown): unknown => Array.isArray(value)
  ? value.map(reorderKeys)
  : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorderKeys(item)]))
    : value

describe('deriveDocument', () => {
  it('derives text, words, reading time, contents and media uses', () => {
    const derived = deriveDocument(fullDocument(), 'pt-BR')
    expect(derived.toc).toEqual([{ id: 'h-intro', level: 2, text: 'Introdução' }, { id: 'h-lists', level: 3, text: 'Listas' }])
    expect(derived.mediaUsages).toEqual([
      { mediaId: MEDIA.photo, context: 'body' },
      { mediaId: MEDIA.clip, context: 'body' },
      { mediaId: MEDIA.photo, context: 'gallery' },
      { mediaId: MEDIA.second, context: 'gallery' },
      { mediaId: MEDIA.third, context: 'gallery' },
      { mediaId: MEDIA.poster, context: 'poster' },
    ])
    // Code stays out of the text; captions, list items, quotes, callouts, tables and embed titles are in
    expect(derived.plainText).not.toContain('console')
    expect(derived.plainText.split('\n')).toEqual([
      'Introdução',
      'Texto com negrito, itálico, código e um link interno e e-mail.',
      'Listas',
      'Um',
      'Dois',
      'Três',
      'Uma citação.',
      'Atenção aqui.',
      'Mídia',
      'Legenda da foto',
      'Palestra sobre acessibilidade',
      'Coluna',
      'Valor',
    ])
    expect(derived.wordCount).toBe(countWords(derived.plainText, 'pt-BR'))
    expect(derived.readingTimeMin).toBe(1)
  })

  it('is deterministic and independent of key order', () => {
    const doc = fullDocument()
    expect(deriveDocument(reorderKeys(doc) as DocumentJson, 'pt-BR')).toEqual(deriveDocument(doc, 'pt-BR'))
  })

  it('keeps toc ids when the heading text changes', () => {
    const doc = fullDocument() as Json
    doc.content[0].content[0].text = 'Outro título'
    expect(deriveDocument(doc, 'pt-BR').toc[0]).toEqual({ id: 'h-intro', level: 2, text: 'Outro título' })
  })

  it('gives zero for an empty document', () => {
    expect(deriveDocument({ type: 'doc', content: [] }, 'en')).toEqual({ plainText: '', wordCount: 0, readingTimeMin: 0, toc: [], mediaUsages: [] })
  })
})

describe('words and reading time', () => {
  it.each<[string, 'pt-BR' | 'de' | 'en', number]>([
    ['Olá, mundo! Tudo bem?', 'pt-BR', 4],
    ['e-mail, guarda-chuva e 42', 'pt-BR', 6],
    ['Donaudampfschifffahrt ist lang.', 'de', 3],
    ['   ', 'en', 0],
  ])('%j has %i words in %s… (Intl.Segmenter)', (text, locale, words) => {
    expect(countWords(text, locale)).toBe(words)
  })

  it.each([[0, 0], [1, 1], [220, 1], [221, 2], [2200, 10]])('%i words read in %i min', (words, minutes) => {
    expect(readingTimeMin(words)).toBe(minutes)
  })
})

describe('segments', () => {
  it('has one segment per text block and attribute, never code, plus the given fields', () => {
    const ids = [...segmentSources(fullDocument(), { title: 'Título', excerpt: '', seoTitle: null }).keys()]
    expect(ids).toEqual(['field:title', 'h-intro', 'p-1', 'h-lists', 'li-1', 'li-2', 'li-3', 'q-p', 'c-p', 'h-media', 'img-1:caption', 'emb-1:title', 'th-1', 'td-1'])
  })

  it('changes only the hash of the edited block, including a mark change', async () => {
    const before = await segmentHashes(fullDocument())
    const doc = fullDocument() as Json
    doc.content[1].content[1].marks = [{ type: 'italic' }]
    const after = await segmentHashes(doc)
    expect(Object.keys(after)).toEqual(Object.keys(before))
    expect(Object.keys(after).filter(id => after[id] !== before[id])).toEqual(['p-1'])
    expect(await segmentHashes(reorderKeys(doc) as DocumentJson)).toEqual(after)
  })

  it('ignores code and media changes', async () => {
    const before = await segmentHashes(fullDocument())
    const doc = fullDocument() as Json
    doc.content.find((node: Json) => node.type === 'image').attrs.mediaId = MEDIA.second
    expect(await segmentHashes(doc)).toEqual(before)
  })

  it('has a segment for an image alt override and a video caption', () => {
    const doc = fullDocument() as Json
    doc.content.find((node: Json) => node.type === 'image').attrs.altOverride = 'Texto alternativo'
    doc.content.find((node: Json) => node.type === 'video').attrs.caption = 'Legenda do vídeo'
    const sources = segmentSources(doc)
    expect(sources.get('img-1:alt')).toBe('Texto alternativo')
    expect(sources.get('vid-1:caption')).toBe('Legenda do vídeo')
  })
})
