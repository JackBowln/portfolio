// F05-T2: the document schema is the XSS boundary of the content (ADR-0006, ADR-0012): every valid node passes,
// and every malicious or malformed payload below is refused with a path that points at the problem
import { describe, expect, it } from 'vitest'
import { DOCUMENT_LIMITS, documentSchema, validateDocument } from '../../shared/content/document-schema'
import { contentHref, linkRel } from '../../shared/content/url'
import { CODE, MEDIA, fullDocument, shikiPre } from '../support/documents'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any -- payloads are built by hand to be wrong

/** fullDocument() changed by `change`, then validated */
function validateChanged(change: (doc: Json) => void) {
  const doc = structuredClone(fullDocument()) as Json
  change(doc)
  return validateDocument(doc)
}

const block = (doc: Json, id: string): Json => {
  const find = (nodes: Json[]): Json => nodes.map(node => (node.attrs?.id === id ? node : node.content && find(node.content))).find(Boolean)
  return find(doc.content)
}
const paragraphText = (doc: Json) => block(doc, 'p-1').content

describe('valid documents', () => {
  it('accepts every node, mark and attribute', () => {
    const result = validateDocument(fullDocument())
    expect(result).toEqual({ ok: true, doc: fullDocument() })
  })

  it('accepts an empty document, one without a version, and empty paragraphs and headings', () => {
    expect(validateDocument({ type: 'doc', content: [] }).ok).toBe(true)
    expect(validateDocument({ type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'a' } }, { type: 'heading', attrs: { id: 'b', level: 2 }, content: [] }] }).ok).toBe(true)
  })

  it('accepts nullable optional attributes and cells without attributes', () => {
    expect(validateChanged((doc) => {
      block(doc, 'img-1').attrs = { id: 'img-1', mediaId: MEDIA.photo }
      block(doc, 'vid-1').attrs = { id: 'vid-1', mediaId: MEDIA.clip, caption: 'Com legenda' }
      block(doc, 'tbl-1').content[0].content[0].attrs = { colspan: 1 }
    }).ok).toBe(true)
  })

  it.each(['vimeo:123456789', 'youtube:a_b-C1d2E3f'])('accepts the embed %s', (value) => {
    const [provider, externalId] = value.split(':')
    expect(validateChanged((doc) => {
      Object.assign(block(doc, 'emb-1').attrs, { provider, externalId })
    }).ok).toBe(true)
  })
})

const refusals: [string, (doc: Json) => void, RegExp][] = [
  // Structure
  ['an unknown node', doc => doc.content.push({ type: 'iframe', attrs: { id: 'x', src: 'https://evil.example' } }), /^content\.\d+\.type: Invalid discriminator value/],
  ['an unknown root', (doc) => { doc.type = 'html' }, /^type: Invalid input/],
  ['an unknown key at the root', (doc) => { doc.html = '<script>' }, /Unrecognized key: "html"/],
  ['an extra attribute on a paragraph', (doc) => { block(doc, 'p-1').attrs.onclick = 'alert(1)' }, /^content\.1\.attrs: Unrecognized key: "onclick"/],
  ['an extra key on a node', (doc) => { block(doc, 'p-1').html = '<b>x</b>' }, /Unrecognized key: "html"/],
  ['a missing block id', (doc) => { delete block(doc, 'p-1').attrs.id }, /^content\.1\.attrs\.id: Invalid input/],
  ['a malformed block id', (doc) => { block(doc, 'p-1').attrs.id = 'a b"><script>' }, /block id must be/],
  ['a duplicate block id', (doc) => { block(doc, 'q-p').attrs.id = 'p-1' }, /block id "p-1" is already used at content\.1/],
  ['a heading of level 1', (doc) => { block(doc, 'h-intro').attrs.level = 1 }, /^content\.0\.attrs\.level: Invalid option: expected one of 2\|3\|4/],
  ['a heading of level 5', (doc) => { block(doc, 'h-intro').attrs.level = 5 }, /attrs\.level/],
  ['a heading inside a list item', doc => block(doc, 'ul-1').content[0].content.push({ type: 'heading', attrs: { id: 'z', level: 2 } }), /content\.4\.content\.0\.content\.1\.type/],
  ['a list item without a paragraph first', (doc) => { block(doc, 'ul-1').content[0].content = [] }, /content\.4\.content\.0\.content/],
  ['an empty list', (doc) => { block(doc, 'ul-1').content = [] }, /content\.4\.content/],
  ['an image inside a paragraph', doc => paragraphText(doc).push({ type: 'image', attrs: { id: 'i', mediaId: MEDIA.photo } }), /content\.1\.content\.\d+\.type/],
  ['empty text', doc => paragraphText(doc).push({ type: 'text', text: '' }), /text must not be empty/],
  ['a text node with extra keys', doc => paragraphText(doc).push({ type: 'text', text: 'x', html: '<img onerror=alert(1)>' }), /Unrecognized key: "html"/],
  ['a schema version from the future', (doc) => { doc.attrs.schemaVersion = 2 }, /^attrs\.schemaVersion/],
  // Marks and links
  ['an unknown mark', doc => paragraphText(doc).push({ type: 'text', text: 'x', marks: [{ type: 'underline' }] }), /marks\.0\.type/],
  ['the same mark twice', doc => paragraphText(doc).push({ type: 'text', text: 'x', marks: [{ type: 'bold' }, { type: 'bold' }] }), /a mark appears twice/],
  ['a link with target', (doc) => { paragraphText(doc)[7].marks[0].attrs.target = '_blank' }, /Unrecognized key: "target"/],
  ['a link with rel', (doc) => { paragraphText(doc)[7].marks[0].attrs.rel = 'opener' }, /Unrecognized key: "rel"/],
  ...['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'tel:+5511999999999', '//evil.example', '\\\\evil.example', 'https:\\\\evil.example', 'file:///etc/passwd', `https://example.com/${'a'.repeat(2048)}`].map((href): [string, (doc: Json) => void, RegExp] => [
    `the link ${JSON.stringify(href.slice(0, 40))}`,
    (doc) => { paragraphText(doc)[7].marks[0].attrs.href = href },
    /^content\.1\.content\.7\.marks\.0\.attrs\.href: /,
  ]),
  // Media and embeds
  ['a media id that is not a UUIDv7', (doc) => { block(doc, 'img-1').attrs.mediaId = '../../originals/x' }, /must be a media id/],
  ['a gallery with one item', (doc) => { block(doc, 'gal-1').attrs.items = [MEDIA.photo] }, /attrs\.items/],
  ['a gallery layout outside the list', (doc) => { block(doc, 'gal-1').attrs.layout = 'carousel' }, /attrs\.layout/],
  ['a video with a poster in the node', (doc) => { block(doc, 'vid-1').attrs.posterId = MEDIA.poster }, /Unrecognized key: "posterId"/],
  ['an image with an src', (doc) => { block(doc, 'img-1').attrs.src = 'https://evil.example/x.png' }, /Unrecognized key: "src"/],
  ['an embed provider outside the allowlist', (doc) => { block(doc, 'emb-1').attrs.provider = 'evil' }, /attrs\.provider/],
  ['an embed id with a path', (doc) => { block(doc, 'emb-1').attrs.externalId = 'dQw4w9WgXcQ/../x' }, /not a valid id for this provider/],
  ['a vimeo id that is not numeric', (doc) => { Object.assign(block(doc, 'emb-1').attrs, { provider: 'vimeo', externalId: 'dQw4w9WgXcQ' }) }, /not a valid id for this provider/],
  ['an embed with a URL', (doc) => { block(doc, 'emb-1').attrs.src = 'https://www.youtube.com/embed/x' }, /Unrecognized key: "src"/],
  ['an embed without a title', (doc) => { block(doc, 'emb-1').attrs.title = '   ' }, /an embed needs a title/],
  ['a callout tone outside the list', (doc) => { block(doc, 'c-1').attrs.tone = 'custom' }, /attrs\.tone/],
  ['a merged table cell', (doc) => { block(doc, 'tbl-1').content[0].content[0].attrs.colspan = 2 }, /attrs\.colspan/],
  ['a table cell with a heading', (doc) => { block(doc, 'tbl-1').content[1].content[0].content = [{ type: 'heading', attrs: { id: 'th', level: 2 } }] }, /content\.0\.type/],
  // Code and HAST
  ['a code language with markup', (doc) => { block(doc, 'code-1').attrs.language = 'ts"><script>' }, /language must be/],
  ['code over the size limit', (doc) => { block(doc, 'code-1').attrs.code = 'x'.repeat(DOCUMENT_LIMITS.codeLength + 1) }, /attrs\.code/],
  ['HAST whose text differs from the code', (doc) => { block(doc, 'code-1').attrs.hast = shikiPre('rm -rf /') }, /the highlighted text differs from the code/],
  ['HAST with a script', (doc) => { block(doc, 'code-1').attrs.hast.children[0].children.push({ type: 'element', tagName: 'script', properties: {}, children: [{ type: 'text', value: 'alert(1)' }] }) }, /hast\.children\.0\.children\.\d+\.tagName: <script> is not allowed here/],
  ['HAST with an img', (doc) => { block(doc, 'code-1').attrs.hast.children[0].children[0].children.push({ type: 'element', tagName: 'img', properties: { src: 'x' }, children: [] }) }, /<img> is not allowed here/],
  ['HAST with onerror', (doc) => { block(doc, 'code-1').attrs.hast.children[0].children[0].properties.onerror = 'alert(1)' }, /"onerror" is not allowed on <span>/],
  ['HAST with an href', (doc) => { block(doc, 'code-1').attrs.hast.properties.href = 'javascript:alert(1)' }, /"href" is not allowed on <pre>/],
  ['HAST with a style that loads a URL', (doc) => { block(doc, 'code-1').attrs.hast.children[0].children[0].children[0].properties.style = 'background:url(https://evil.example/x)' }, /is not an allowed Shiki style/],
  ['HAST with a Shiki variable set to a URL', (doc) => { block(doc, 'code-1').attrs.hast.children[0].children[0].children[0].properties.style = '--shiki-light:url(x)' }, /is not an allowed Shiki style/],
  ['HAST with a class outside the list', (doc) => { block(doc, 'code-1').attrs.hast.properties.class = 'shiki sr-only' }, /class "sr-only" is not allowed/],
  ['HAST with a raw node', (doc) => { block(doc, 'code-1').attrs.hast.children[0].children.push({ type: 'raw', value: '<script>alert(1)</script>' }) }, /node type "raw" is not allowed/],
  ['HAST rooted at a span', (doc) => { block(doc, 'code-1').attrs.hast = { type: 'element', tagName: 'span', properties: {}, children: [{ type: 'text', value: CODE }] } }, /<span> is not allowed here/],
]

describe('refused payloads', () => {
  it.each(refusals)('refuses %s', (_name, change, pattern) => {
    const result = validateChanged(change)
    expect(result.ok).toBe(false)
    const issues = result.ok ? [] : result.issues.map(issue => `${issue.path}: ${issue.message}`)
    expect(issues.some(issue => pattern.test(issue)), issues.join('\n')).toBe(true)
  })

  it('refuses __proto__ keys from parsed JSON without polluting prototypes', () => {
    const result = validateDocument(JSON.parse('{"type":"doc","content":[{"type":"paragraph","attrs":{"id":"a","__proto__":{"x":1}}}],"__proto__":{"polluted":true}}'))
    expect(result).toEqual({ ok: false, issues: [{ path: 'content.0.attrs', message: 'Unrecognized key: "__proto__"' }, { path: '', message: 'Unrecognized key: "__proto__"' }] })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('has at least 30 refusal cases', () => {
    expect(refusals.length).toBeGreaterThanOrEqual(30)
  })
})

describe('limits', () => {
  const paragraphs = (count: number, text = 'x') => Array.from({ length: count }, (_, index) => ({ type: 'paragraph', attrs: { id: `p${index}` }, content: [{ type: 'text', text }] }))

  it('refuses a document over the size limit before parsing it', () => {
    const result = validateDocument({ type: 'doc', content: paragraphs(3, 'x'.repeat(DOCUMENT_LIMITS.size / 2)) })
    expect(result).toEqual({ ok: false, issues: [{ path: '', message: expect.stringMatching(/more than 524288/) }] })
  })

  it('refuses more nodes than the limit', () => {
    const result = validateDocument({ type: 'doc', content: paragraphs(DOCUMENT_LIMITS.nodes) })
    expect(result.ok ? [] : result.issues.map(issue => issue.message)).toContainEqual(expect.stringMatching(/nodes, more than 5000/))
  })

  it('refuses nesting deeper than the limit', () => {
    let list: Json = { type: 'paragraph', attrs: { id: 'leaf' } }
    for (let level = 0; level < 8; level++) {
      list = { type: 'bulletList', attrs: { id: `l${level}` }, content: [{ type: 'listItem', content: [{ type: 'paragraph', attrs: { id: `lp${level}` } }, list] }] }
    }
    const result = validateDocument({ type: 'doc', content: [list] })
    expect(result.ok ? [] : result.issues.map(issue => issue.message)).toContainEqual(expect.stringMatching(/deeper than 12/))
  })

  it.each([['a string', 'doc'], ['null', null], ['a cycle', (() => {
    const doc: Json = { type: 'doc', content: [] }
    doc.content.push(doc)
    return doc
  })()]])('refuses %s', (_name, input) => {
    expect(validateDocument(input).ok).toBe(false)
  })

  it('parses a 50 KB document quickly', () => {
    const doc = { type: 'doc', content: paragraphs(400, 'Uma frase de exemplo com várias palavras para medir. '.repeat(2)) }
    expect(JSON.stringify(doc).length).toBeGreaterThan(50_000)
    documentSchema.parse(doc)
    const started = performance.now()
    for (let run = 0; run < 10; run++) {
      documentSchema.parse(doc)
    }
    const perParse = (performance.now() - started) / 10
    console.log(`[F05-T2] documentSchema.parse on ${JSON.stringify(doc).length} chars: ${perParse.toFixed(2)} ms (Node)`)
    expect(perParse).toBeLessThan(20)
  })
})

describe('contentHref and linkRel', () => {
  it.each(['https://example.com', 'http://example.com/a', 'mailto:a@example.com', '/blog/x', '#secao', '?q=1', 'relativo'])('accepts %s', (href) => {
    expect(contentHref(href)).toBe(href)
  })

  it.each(['', ' /a', 'tel:123', 'ftp://x', 'javascript:x'])('refuses %j', (href) => {
    expect(contentHref(href)).toBeUndefined()
  })

  it('derives rel only for external links', () => {
    expect(linkRel('https://example.com/x', 'https://site.example')).toBe('noopener noreferrer')
    expect(linkRel('https://site.example/blog', 'https://site.example')).toBeUndefined()
    expect(linkRel('/blog')).toBeUndefined()
    expect(linkRel('mailto:a@example.com')).toBeUndefined()
  })
})
