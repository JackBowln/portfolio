// F05-T4: heading anchors are readable ASCII slugs, unique in the page, and never take the frame's own ids
import { describe, expect, it } from 'vitest'
import { anchorSlug, headingAnchors } from '../../shared/content/anchors'
import type { DocumentJson } from '../../shared/content/document-schema'

const heading = (id: string, text?: string) => ({ type: 'heading', attrs: { id, level: 2 }, content: text ? [{ type: 'text', text }] : undefined })

describe('heading anchors', () => {
  it.each([
    ['Como funciona? (v2)', 'como-funciona-v2'],
    ['Ação & Reação', 'acao-reacao'],
    ['Straße für Übung', 'strasse-fuer-uebung'],
    ['  --Já!--  ', 'ja'],
    ['日本語', 'section'],
    ['', 'section'],
    ['a'.repeat(100), 'a'.repeat(64)],
    ['palavra '.repeat(12), 'palavra-palavra-palavra-palavra-palavra-palavra-palavra-palavra'],
  ])('slugs %j as %j', (text, slug) => {
    expect(anchorSlug(text)).toBe(slug)
  })

  it('numbers repeats, skips reserved ids and ignores nested or non-heading blocks', () => {
    const doc = { type: 'doc', content: [
      heading('a', 'Intro'),
      heading('b', 'Intro'),
      heading('c', 'Main'),
      heading('d'),
      heading('e', 'Section'),
      { type: 'paragraph', attrs: { id: 'p' }, content: [{ type: 'text', text: 'Intro' }] },
      heading('f', 'Intro'),
    ] } as unknown as DocumentJson
    expect([...headingAnchors(doc)]).toEqual([['a', 'intro'], ['b', 'intro-2'], ['c', 'main-2'], ['d', 'section'], ['e', 'section-2'], ['f', 'intro-3']])
  })
})
