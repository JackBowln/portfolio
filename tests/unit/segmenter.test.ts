// F09-T2: the segmenter and its inline tags. Property tests over random documents valid by the schema (a seeded
// generator, every node type): extracting and reinserting the untouched text is the identity; a translation that
// keeps the tags rebuilds the marks; a missing, extra or reordered tag fails that segment and nothing else; code
// blocks, inline code, URLs and protected terms never reach the payload
import { describe, expect, it } from 'vitest'
import type { DocumentJson } from '../../shared/content/document-schema'
import { documentSchema } from '../../shared/content/document-schema'
import type { InlineNode, Mark, ProtectedTerm } from '../../shared/content/inline-tags'
import { tagInline, tagPlainText, untagInline, untagPlainText } from '../../shared/content/inline-tags'
import { extractDocument, extractField, reinsertDocument, reinsertField } from '../../shared/content/segmenter'
import { CODE, fullDocument, MEDIA, shikiPre } from '../support/documents'

// mulberry32: a small seeded generator, so a failure always reproduces with its seed
function random(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  const int = (max: number) => Math.floor(next() * max)
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]!
  return { next, int, pick }
}

type Random = ReturnType<typeof random>

const TERMS: ProtectedTerm[] = [{ term: 'Nuxt', caseSensitive: true }, { term: 'cloudflare workers', caseSensitive: false }]
const WORDS = ['texto', 'com', 'Nuxt', 'Cloudflare Workers', 'a < b', 'R&D', '1 > 0', 'ção', 'emoji 🙂', 'espaço  duplo']
const HREFS = ['https://example.com/a?b=1&c=2', '/blog/outro', 'mailto:ola@example.com']
// Marks in one fixed order, as the editor stores them
const MARK_ORDER = ['bold', 'italic', 'strike', 'code', 'link'] as const

let counter = 0
const nextId = (prefix: string) => `${prefix}-${++counter}`

function marks(rng: Random): Mark[] | undefined {
  const chosen = MARK_ORDER.filter(() => rng.next() < 0.25)
  if (chosen.length === 0) {
    return undefined
  }
  return chosen.map(type => (type === 'link' ? { type, attrs: { href: rng.pick(HREFS) } } : { type }))
}

const markSet = (node: InlineNode) => (node.type === 'text' ? JSON.stringify(node.marks ?? []) : 'br')

function inline(rng: Random): InlineNode[] {
  const nodes: InlineNode[] = []
  const count = 1 + rng.int(6)
  for (let index = 0; index < count; index++) {
    if (index > 0 && rng.next() < 0.15) {
      nodes.push({ type: 'hardBreak' })
      continue
    }
    const words = Array.from({ length: 1 + rng.int(3) }, () => rng.pick(WORDS)).join(' ')
    const node: InlineNode = { type: 'text', text: ` ${words} `, marks: marks(rng) }
    if (node.marks?.some(mark => mark.type === 'code')) {
      node.text = `codigo${++counter}`
    }
    if (!node.marks) {
      delete node.marks
    }
    // The editor merges neighbours with the same marks; so does the generator
    const previous = nodes.at(-1)
    if (previous && previous.type === 'text' && markSet(previous) === markSet(node)) {
      previous.text += node.text
    }
    else {
      nodes.push(node)
    }
  }
  return nodes.some(node => node.type === 'text') ? nodes : [{ type: 'text', text: 'texto' }]
}

const paragraph = (rng: Random) => ({ type: 'paragraph' as const, attrs: { id: nextId('p') }, content: inline(rng) })
const list = (rng: Random, depth: number): Record<string, unknown> => ({
  type: rng.next() < 0.5 ? 'bulletList' : 'orderedList',
  attrs: rng.next() < 0.5 ? { id: nextId('ul') } : { id: nextId('ol'), start: 1 + rng.int(5) },
  content: Array.from({ length: 1 + rng.int(3) }, () => ({
    type: 'listItem',
    content: [paragraph(rng), ...(depth < 2 && rng.next() < 0.3 ? [list(rng, depth + 1)] : [])],
  })),
})
const fixList = (node: Record<string, unknown>): Record<string, unknown> => {
  // bulletList has no start; orderedList needs one
  const attrs = node.attrs as { id: string, start?: number }
  const fixed = node.type === 'bulletList' ? { id: attrs.id } : { id: attrs.id, start: attrs.start ?? 1 }
  const content = (node.content as { type: string, content: Record<string, unknown>[] }[]).map(item => ({ ...item, content: item.content.map(child => (child.type === 'paragraph' ? child : fixList(child))) }))
  return { ...node, attrs: fixed, content }
}
const textBlocks = (rng: Random) => Array.from({ length: 1 + rng.int(2) }, () => (rng.next() < 0.7 ? paragraph(rng) : fixList(list(rng, 1))))
const caption = (rng: Random) => (rng.next() < 0.5 ? null : rng.pick(['Legenda com Nuxt', 'Foto & vídeo', 'a < b']))

const BLOCKS: ((rng: Random) => Record<string, unknown>)[] = [
  paragraph,
  rng => ({ type: 'heading', attrs: { id: nextId('h'), level: rng.pick([2, 3, 4]) }, content: inline(rng) }),
  rng => fixList(list(rng, 0)),
  rng => ({ type: 'blockquote', attrs: { id: nextId('q') }, content: textBlocks(rng) }),
  rng => ({ type: 'callout', attrs: { id: nextId('c'), tone: rng.pick(['info', 'tip', 'warning', 'danger']) }, content: textBlocks(rng) }),
  () => ({ type: 'horizontalRule', attrs: { id: nextId('hr') } }),
  () => ({ type: 'codeBlock', attrs: { id: nextId('code'), language: 'ts', code: CODE, hast: shikiPre(CODE) } }),
  rng => ({ type: 'image', attrs: { id: nextId('img'), mediaId: MEDIA.photo, caption: caption(rng), altOverride: caption(rng) } }),
  () => ({ type: 'gallery', attrs: { id: nextId('gal'), items: [MEDIA.second, MEDIA.third], layout: 'grid' } }),
  rng => ({ type: 'video', attrs: { id: nextId('vid'), mediaId: MEDIA.clip, caption: caption(rng) } }),
  rng => ({ type: 'embed', attrs: { id: nextId('emb'), provider: 'youtube', externalId: 'dQw4w9WgXcQ', title: rng.pick(['Palestra sobre Nuxt', 'Vídeo & demo']), posterMediaId: MEDIA.poster } }),
  rng => ({
    type: 'table',
    attrs: { id: nextId('tbl') },
    content: Array.from({ length: 1 + rng.int(2) }, (_, row) => ({
      type: 'tableRow',
      content: Array.from({ length: 1 + rng.int(2) }, () => ({ type: row === 0 ? 'tableHeader' : 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [paragraph(rng)] })),
    })),
  }),
]

function randomDocument(seed: number): DocumentJson {
  const rng = random(seed)
  const content = Array.from({ length: 1 + rng.int(8) }, () => rng.pick(BLOCKS)(rng))
  // Every node type at least once across the run: the seed picks the first block
  content.unshift(BLOCKS[seed % BLOCKS.length]!(rng))
  return documentSchema.parse({ type: 'doc', attrs: { schemaVersion: 1 }, content }) as DocumentJson
}

const SEEDS = Array.from({ length: 300 }, (_, index) => index + 1)
const own = (segments: { id: string, text: string }[]) => Object.fromEntries(segments.map(segment => [segment.id, segment.text]))
// Uppercases the text between tags: a "translation" that keeps every tag
const shout = (text: string) => text.replace(/(^|>)([^<]*)/g, (_, tag: string, words: string) => tag + words.toUpperCase().replace(/&(LT|GT|AMP);/g, entity => entity.toLowerCase()))

describe('segmenter properties (300 random documents)', () => {
  it('extract → reinsert unchanged is the identity, for every node type', () => {
    for (const seed of SEEDS) {
      const document = randomDocument(seed)
      const { segments, extraction } = extractDocument(document, TERMS)
      const { document: back, failed } = reinsertDocument(document, extraction, own(segments))
      expect(failed, `seed ${seed}`).toEqual([])
      expect(back, `seed ${seed}`).toEqual(document)
    }
  })

  it('never sends code, URLs or protected terms', () => {
    for (const seed of SEEDS) {
      const document = randomDocument(seed)
      const payload = JSON.stringify(extractDocument(document, TERMS).segments)
      expect(payload, `seed ${seed}`).not.toContain('const answer')
      expect(payload, `seed ${seed}`).not.toMatch(/codigo\d+/)
      for (const href of HREFS) {
        expect(payload, `seed ${seed}`).not.toContain(href)
      }
      expect(payload, `seed ${seed}`).not.toMatch(/(?<![\p{L}\p{N}_])Nuxt(?![\p{L}\p{N}_])/u)
      expect(payload.toLowerCase(), `seed ${seed}`).not.toContain('cloudflare workers')
    }
  })

  it('a translation that keeps the tags is put back with its marks and protected parts', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const document = randomDocument(seed)
      const { segments, extraction } = extractDocument(document, TERMS)
      const translations = Object.fromEntries(segments.map(segment => [segment.id, shout(segment.text)]))
      const { document: back, failed } = reinsertDocument(document, extraction, translations)
      expect(failed, `seed ${seed}`).toEqual([])
      // The protected parts come back as they were; the rest is the translation
      const again = extractDocument(back, TERMS).segments
      expect(again.map(segment => segment.text), `seed ${seed}`).toEqual(segments.map(segment => shout(segment.text)))
      if (JSON.stringify(document).includes('const answer')) {
        expect(JSON.stringify(back), `seed ${seed}`).toContain('const answer')
      }
    }
  })

  it('a missing, extra or reordered tag fails only that segment, and the document stays valid and as it was there', () => {
    let checked = 0
    for (const seed of SEEDS) {
      const document = randomDocument(seed)
      const { segments, extraction } = extractDocument(document, TERMS)
      const target = segments.find(segment => (segment.text.match(/<[^>]+>/g) ?? []).length >= 2)
      if (!target) {
        continue
      }
      const tags = target.text.match(/<[^>]+>/g)!
      const broken = [
        target.text.replace(tags[0]!, ''),
        `${target.text}${tags[0]}`,
        target.text.replace(tags[0]!, '\u0000').replace(tags[1]!, tags[0]!).replace('\u0000', tags[1]!),
      ].filter(text => text !== target.text)
      for (const text of broken) {
        const { document: back, failed } = reinsertDocument(document, extraction, { ...own(segments), [target.id]: text })
        if (tags[0] === tags[1] && text.includes(tags[0]!)) {
          continue
        }
        expect(failed, `seed ${seed}: ${text}`).toEqual([target.id])
        expect(back, `seed ${seed}`).toEqual(document)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(100)
  })
})

describe('inline tags', () => {
  it('nests marks like HTML, links outermost, and numbers links and placeholders', () => {
    const content: InlineNode[] = [
      { type: 'text', text: 'Veja ' },
      { type: 'text', text: 'o guia', marks: [{ type: 'link', attrs: { href: 'https://x.dev' } }] },
      { type: 'text', text: ' do Nuxt', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://x.dev' } }] },
      { type: 'hardBreak' },
      { type: 'text', text: 'npm i', marks: [{ type: 'code' }] },
    ]
    const tagged = tagInline(content, TERMS)
    // A break and a code node keep the marks around them open: only text changes the marks
    expect(tagged.text).toBe('Veja <a1>o guia<b> do <x1/><br/><x2/></b></a1>')
    expect(tagged.tags).toEqual(['a1', 'b', 'x1', 'br', 'x2', '/b', '/a1'])
    expect(untagInline(tagged.text, tagged)).toEqual({ ok: true, content })
  })

  it('escapes and unescapes the text', () => {
    const tagged = tagInline([{ type: 'text', text: 'a < b & c > d' }])
    expect(tagged.text).toBe('a &lt; b &amp; c &gt; d')
    expect(untagInline('x &lt; y', tagged)).toEqual({ ok: true, content: [{ type: 'text', text: 'x < y' }] })
  })

  it('protects whole words only, longest first, with the case rule of each term', () => {
    const tagged = tagPlainText('Nuxt, nuxt, Nuxtify e CLOUDFLARE WORKERS', TERMS)
    expect(tagged.text).toBe('<x1/>, nuxt, Nuxtify e <x2/>')
    expect(untagPlainText('<x1/> und <x2/>', tagged)).toEqual({ ok: true, text: 'Nuxt und CLOUDFLARE WORKERS' })
    expect(tagPlainText('sem termos', []).text).toBe('sem termos')
    expect(tagPlainText('Nuxt', [{ term: '  ', caseSensitive: false }]).text).toBe('Nuxt')
  })

  it('refuses changed, unknown or dropped tags and an empty translation', () => {
    const tagged = tagInline([{ type: 'text', text: 'a' }, { type: 'text', text: 'b', marks: [{ type: 'bold' }] }])
    expect(tagged.text).toBe('a<b>b</b>')
    // Words may move across a mark ("<b>a</b>b" is a valid translation); the tags may not
    for (const text of ['a<i>b</i>', 'a b', 'a<b>b</b><b></b>', 'a</b>b<b>']) {
      expect(untagInline(text, tagged), text).toEqual({ ok: false, reason: 'tags' })
    }
    expect(untagInline('<b> </b>', tagged)).toEqual({ ok: false, reason: 'empty' })
    // An unknown tag-like text is only text, so the real tags still decide
    expect(untagInline('x <u>y</u><b>z</b>', tagged)).toEqual({ ok: true, content: [{ type: 'text', text: 'x <u>y</u>' }, { type: 'text', text: 'z', marks: [{ type: 'bold' }] }] })
    expect(untagPlainText('<x1/>', tagPlainText('texto'))).toEqual({ ok: false, reason: 'tags' })
  })
})

describe('segments of a document', () => {
  it('names every text by its top-level block, nested ones by their own id, attributes by suffix', () => {
    const ids = extractDocument(fullDocument()).segments.map(segment => segment.id)
    expect(ids).toEqual([
      'block:h-intro', 'block:p-1', 'block:h-lists', 'block:ul-1/li-1', 'block:ul-1/li-2', 'block:ul-1/li-3',
      'block:q-1/q-p', 'block:c-1/c-p', 'block:h-media', 'block:img-1/caption', 'block:emb-1/title', 'block:tbl-1/th-1', 'block:tbl-1/td-1',
    ])
  })

  it('leaves a segment without translation as it was, and puts plain fields back', () => {
    const document = fullDocument()
    const { segments, extraction } = extractDocument(document)
    const { document: back } = reinsertDocument(document, extraction, { 'block:h-intro': 'Introduction', 'block:img-1/caption': 'Photo caption' })
    expect(back.content[0]).toMatchObject({ content: [{ type: 'text', text: 'Introduction' }] })
    expect(back.content.find(block => block.type === 'image')).toMatchObject({ attrs: { caption: 'Photo caption' } })
    expect(back.content[1]).toEqual(document.content[1])
    expect(segments).toHaveLength(13)
    const failedCaption = reinsertDocument(document, extraction, { 'block:img-1/caption': '<x1/>' })
    expect(failedCaption.failed).toEqual(['block:img-1/caption'])

    const { segment, tagged } = extractField('title', 'Guia de Nuxt', TERMS)
    expect(segment).toEqual({ id: 'title', text: 'Guia de <x1/>' })
    expect(reinsertField('<x1/> guide', tagged)).toEqual({ ok: true, text: 'Nuxt guide' })
    expect(reinsertField('guide', tagged)).toEqual({ ok: false })
  })
})

describe('review text', () => {
  it('turns term placeholders back into the terms and renumbers code placeholders', async () => {
    const { withoutTerms } = await import('../../shared/content/inline-tags')
    const content: InlineNode[] = [{ type: 'text', text: 'Use Nuxt e ' }, { type: 'text', text: 'npm i', marks: [{ type: 'code' }] }, { type: 'text', text: ' com Nuxt & cia' }]
    const protectedText = tagInline(content, TERMS)
    expect(protectedText.text).toBe('Use <x1/> e <x2/> com <x3/> &amp; cia')
    const review = withoutTerms('Use <x1/> and <x2/> with <x3/> &amp; co', protectedText)
    expect(review).toBe('Use Nuxt and <x1/> with Nuxt &amp; co')
    // It reads back against the term-free tagging of the same source
    expect(untagInline(review, tagInline(content))).toMatchObject({ ok: true })
    expect(withoutTerms('<x9/>', protectedText)).toBe('<x9/>')
  })
})
