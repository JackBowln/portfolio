// F09-T1: the translation state machine (data-model §8) and the source segments with their hashes: stable for the
// same text, by block id for documents, by path for page blocks, without slugs or choices; comparing a translation's
// meta tells exactly which segments changed
import { describe, expect, it } from 'vitest'
import { approvedMeta, articleSegments, compareSegments, fieldSegments, hashSegments, pageSegments, projectSegments } from '../../shared/content/segment-hash'
import type { DocumentJson } from '../../shared/content/document-schema'
import { canTransition, isPublishable, TRANSLATION_TRANSITIONS } from '../../shared/translation/states'
import { TRANSLATION_STATES } from '../../shared/types/enums'

const doc = (...texts: [string, string][]): DocumentJson => ({
  type: 'doc',
  attrs: { schemaVersion: 1 },
  content: texts.map(([id, text]) => ({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text }] })),
})

describe('translation transitions', () => {
  it('follow the diagram in data-model §8 and nothing else', () => {
    const allowed = TRANSLATION_STATES.flatMap(from => TRANSLATION_STATES.filter(to => canTransition(from, to)).map(to => `${from}→${to}`))
    expect(allowed).toEqual(['missing→machine', 'missing→in_review', 'machine→in_review', 'machine→approved', 'in_review→approved', 'approved→outdated', 'outdated→in_review'])
    expect(TRANSLATION_TRANSITIONS.source).toEqual([])
  })

  it('only the original and approved translations publish', () => {
    expect(TRANSLATION_STATES.filter(isPublishable)).toEqual(['source', 'approved'])
  })
})

describe('source segments', () => {
  it('splits an article into fields and top-level blocks, skipping the slug and empty fields', () => {
    const segments = articleSegments({ title: ' Título ', excerpt: '', seoTitle: null, seoDescription: 'Desc', body: doc(['a', 'Um'], ['b', 'Dois']), slug: 'titulo' } as never)
    expect(Object.keys(segments)).toEqual(['title', 'seoDescription', 'block:a', 'block:b'])
    expect(segments.title).toBe('Título')
  })

  it('keys a project highlight by position and a block without id by its index', () => {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] } as DocumentJson
    expect(Object.keys(projectSegments({ title: 'P', role: 'Dev', highlights: [{ label: 'L', value: '10' }], body }))).toEqual(['title', 'role', 'highlights.0.label', 'highlights.0.value', 'block:#0'])
  })

  it('walks page blocks by path, documents by block, and leaves out targets, dates and URLs', () => {
    const segments = pageSegments({
      blocks: { hero: { title: 'Olá', cta: { label: 'Ver', target: 'projects' } }, timeline: [{ period: '2024', text: 'Fiz' }], links: [{ label: 'GitHub', url: 'https://x.dev' }], intro: doc(['i', 'Intro']), updatedOn: '2026-10-01' },
      seoTitle: 'SEO',
    })
    expect(Object.keys(segments)).toEqual(['blocks.hero.title', 'blocks.hero.cta.label', 'blocks.timeline.0.period', 'blocks.timeline.0.text', 'blocks.links.0.label', 'blocks.intro:block:i', 'seoTitle'])
  })

  it('hashes the same text the same way, and a changed mark changes its block', async () => {
    const plain = doc(['a', 'Um'])
    const bold: DocumentJson = { ...plain, content: [{ type: 'paragraph', attrs: { id: 'a' }, content: [{ type: 'text', text: 'Um', marks: [{ type: 'bold' }] }] }] }
    const [first, again, marked] = await Promise.all([hashSegments(articleSegments({ body: plain })), hashSegments(articleSegments({ body: plain })), hashSegments(articleSegments({ body: bold }))])
    expect(again).toEqual(first)
    expect(marked['block:a']).not.toBe(first['block:a'])
    expect(first['block:a']).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('compareSegments', () => {
  it('marks only the changed, new and removed segments, keeping the hash they were approved against', async () => {
    const before = await hashSegments(fieldSegments({ alt: 'Gato', caption: 'Foto', credit: 'Eu' }))
    const after = await hashSegments(fieldSegments({ alt: 'Gato preto', caption: 'Foto', role: 'Novo' }))
    const { meta, changed } = compareSegments(approvedMeta(before), after)
    expect(changed.sort()).toEqual(['alt', 'credit', 'role'])
    expect(meta.alt).toEqual({ sourceHash: before.alt, state: 'outdated' })
    expect(meta.caption).toEqual({ sourceHash: before.caption, state: 'approved' })
    expect(meta.role).toEqual({ sourceHash: '', state: 'outdated' })
    expect(meta).not.toHaveProperty('credit')
    expect(compareSegments(approvedMeta(before), before)).toEqual({ meta: approvedMeta(before), changed: [] })
  })
})
