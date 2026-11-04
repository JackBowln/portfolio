// Inline content as tagged text for translation (F09-T2, ADR-0009 §3). Marks become tags the model must keep:
// <a1>…</a1> (a link; its href stays here), <b>, <i>, <s>, and <br/> for a hard break. What must never be translated
// nor sent becomes an empty placeholder <x1/>, <x2/>…: inline code (the whole text node) and the protected glossary
// terms. The text itself is escaped (&amp; &lt; &gt;). Reading a translation back accepts only the same tags in the
// same order; anything else is a failure, and the caller keeps the original. Pure and isomorphic
import { inlineText } from './inline-text.ts'

export interface TextNode {
  type: 'text'
  text: string
  marks?: Mark[] | undefined
}
export interface HardBreak { type: 'hardBreak' }
export type InlineNode = TextNode | HardBreak
export type Mark = { type: 'bold' | 'italic' | 'strike' | 'code' } | { type: 'link', attrs: { href: string } }

/** A term that must reach the translation unchanged (glossary doNotTranslate) */
export interface ProtectedTerm {
  term: string
  caseSensitive: boolean
}

/** What the tagged text left out, by placeholder number: a whole code node or a protected term's exact text */
export type Slot = { kind: 'node', node: TextNode } | { kind: 'term', text: string }

export interface TaggedText {
  /** The text sent for translation */
  text: string
  /** <xN/> → what it stands for */
  slots: Slot[]
  /** <aN> → the link mark it stands for */
  links: Mark[]
  /** The tag sequence a translation must keep */
  tags: string[]
  /** The source's marks arrays by mark set, so a rebuilt node keeps the original order of its marks */
  markOrders: Record<string, Mark[]>
}

const SIMPLE_TAG = { bold: 'b', italic: 'i', strike: 's' } as const
type SimpleMark = keyof typeof SIMPLE_TAG
const SIMPLE_MARK = { b: 'bold', i: 'italic', s: 'strike' } as const
// Opening order: a link wraps everything inside it
const RANK: Record<string, number> = { link: 0, bold: 1, italic: 2, strike: 3 }

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const unescape = (text: string) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

const markKey = (mark: Mark): string => (mark.type === 'link' ? `link:${mark.attrs.href}` : mark.type)
const setKey = (marks: readonly Mark[]): string => marks.map(markKey).sort().join('|')

function termPattern(terms: readonly ProtectedTerm[]): RegExp | undefined {
  const usable = terms.filter(item => item.term.trim() !== '')
  if (usable.length === 0) {
    return undefined
  }
  // Longest first, so "Nuxt UI" wins over "Nuxt"; whole words only (letters and digits around do not count)
  const alternatives = [...usable].sort((a, b) => b.term.length - a.term.length).map((item) => {
    const source = item.term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return item.caseSensitive ? source : `(?i:${source})`
  })
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}_])`, 'gu')
}

/** Escaped text with the protected terms replaced by placeholders, which are added to `slots` */
function protect(text: string, pattern: RegExp | undefined, slots: Slot[]): string {
  if (!pattern) {
    return escape(text)
  }
  let out = ''
  let last = 0
  for (const match of text.matchAll(pattern)) {
    out += escape(text.slice(last, match.index))
    slots.push({ kind: 'term', text: match[0] })
    out += `<x${slots.length}/>`
    last = match.index + match[0].length
  }
  return out + escape(text.slice(last))
}

/** Plain text (a title, a caption) as tagged text: only the protected terms become placeholders */
export function tagPlainText(text: string, terms: readonly ProtectedTerm[] = []): TaggedText {
  const slots: Slot[] = []
  const tagged = protect(text, termPattern(terms), slots)
  return { text: tagged, slots, links: [], tags: slots.map((_, index) => `x${index + 1}`), markOrders: {} }
}

/** Inline content as tagged text; marks open and close only where they change, like HTML */
export function tagInline(content: readonly InlineNode[], terms: readonly ProtectedTerm[] = []): TaggedText {
  const pattern = termPattern(terms)
  const slots: Slot[] = []
  const links: Mark[] = []
  const tags: string[] = []
  const markOrders: Record<string, Mark[]> = {}
  const open: { key: string, tag: string }[] = []
  let text = ''

  const emit = (tag: string, literal: string) => {
    tags.push(tag)
    text += literal
  }
  const closeTo = (depth: number) => {
    while (open.length > depth) {
      const { tag } = open.pop()!
      emit(`/${tag}`, `</${tag}>`)
    }
  }
  const openMark = (mark: Mark) => {
    let tag: string
    if (mark.type === 'link') {
      links.push(mark)
      tag = `a${links.length}`
    }
    else {
      tag = SIMPLE_TAG[mark.type as SimpleMark]
    }
    open.push({ key: markKey(mark), tag })
    emit(tag, `<${tag}>`)
  }

  for (const node of content) {
    if (node.type === 'hardBreak') {
      // A break keeps the marks around it open; it is the same tag in every place
      emit('br', '<br/>')
      continue
    }
    const marks = node.marks ?? []
    if (marks.some(mark => mark.type === 'code')) {
      // Code is never sent nor translated: the whole node waits here, marks included
      slots.push({ kind: 'node', node })
      emit(`x${slots.length}`, `<x${slots.length}/>`)
      continue
    }
    markOrders[setKey(marks)] ??= marks
    const wanted = [...marks].sort((a, b) => RANK[a.type]! - RANK[b.type]!)
    const keys = wanted.map(markKey)
    // Keep the open marks that are still wanted, from the outside in; close from the first one that is not
    let keep = 0
    while (keep < open.length && keys.includes(open[keep]!.key)) {
      keep++
    }
    closeTo(keep)
    for (const mark of wanted.filter(item => !open.some(entry => entry.key === markKey(item)))) {
      openMark(mark)
    }
    const before = slots.length
    text += protect(node.text, pattern, slots)
    for (let index = before; index < slots.length; index++) {
      tags.push(`x${index + 1}`)
    }
  }
  closeTo(0)
  return { text, slots, links, tags, markOrders }
}

const TOKEN = /<(\/?)(a\d+|b|i|s)>|<br\/>|<x(\d+)\/>/g

type Token = { kind: 'text', text: string } | { kind: 'open' | 'close', tag: string } | { kind: 'br' } | { kind: 'slot', index: number }

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let last = 0
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > last) {
      tokens.push({ kind: 'text', text: unescape(text.slice(last, match.index)) })
    }
    if (match[0] === '<br/>') {
      tokens.push({ kind: 'br' })
    }
    else if (match[3] !== undefined) {
      tokens.push({ kind: 'slot', index: Number(match[3]) })
    }
    else {
      tokens.push({ kind: match[1] ? 'close' : 'open', tag: match[2]! })
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    tokens.push({ kind: 'text', text: unescape(text.slice(last)) })
  }
  return tokens
}

const tagOf = (token: Token): string | undefined => {
  switch (token.kind) {
    case 'open': return token.tag
    case 'close': return `/${token.tag}`
    case 'br': return 'br'
    case 'slot': return `x${token.index}`
    default: return undefined
  }
}

export type UntagResult = { ok: true, content: InlineNode[] } | { ok: false, reason: 'tags' | 'empty' }

/**
 * A translation back into inline content. Its tags must be exactly the source's, in the same order (so links,
 * placeholders and nesting are intact); otherwise it fails and nothing is rebuilt. Adjacent text with the same marks
 * becomes one node, as the editor keeps it
 */
export function untagInline(translated: string, source: TaggedText): UntagResult {
  const tokens = tokenize(translated)
  const tags = tokens.map(tagOf).filter((tag): tag is string => tag !== undefined)
  if (tags.length !== source.tags.length || tags.some((tag, index) => tag !== source.tags[index])) {
    return { ok: false, reason: 'tags' }
  }

  const content: InlineNode[] = []
  const stack: Mark[] = []
  const push = (text: string, marks: readonly Mark[]) => {
    if (text === '') {
      return
    }
    const previous = content.at(-1)
    if (previous?.type === 'text' && setKey(previous.marks ?? []) === setKey(marks)) {
      previous.text += text
      return
    }
    const ordered = source.markOrders[setKey(marks)] ?? marks
    content.push(ordered.length > 0 ? { type: 'text', text, marks: ordered.map(mark => structuredClone(mark)) } : { type: 'text', text })
  }
  for (const token of tokens) {
    if (token.kind === 'text') {
      push(token.text, stack)
    }
    else if (token.kind === 'br') {
      content.push({ type: 'hardBreak' })
    }
    else if (token.kind === 'slot') {
      const slot = source.slots[token.index - 1]!
      if (slot.kind === 'node') {
        content.push(structuredClone(slot.node))
      }
      else {
        push(slot.text, stack)
      }
    }
    else if (token.kind === 'open') {
      stack.push(token.tag.startsWith('a') ? source.links[Number(token.tag.slice(1)) - 1]! : { type: SIMPLE_MARK[token.tag as keyof typeof SIMPLE_MARK] })
    }
    else {
      stack.pop()
    }
  }
  // A source with text never comes back empty (a model that dropped the sentence)
  if (inlineText(content).trim() === '' && source.text.trim() !== '') {
    return { ok: false, reason: 'empty' }
  }
  return { ok: true, content }
}

/** A translated plain text back: the same placeholders in the same order, else a failure */
export function untagPlainText(translated: string, source: TaggedText): { ok: true, text: string } | { ok: false, reason: 'tags' | 'empty' } {
  const result = untagInline(translated, source)
  if (!result.ok) {
    return result
  }
  return { ok: true, text: result.content.map(node => (node.type === 'text' ? node.text : '')).join('') }
}
