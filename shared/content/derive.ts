// Data the server derives from a document on every save (ADR-0006 §4, data-model §4.2): plain text, word count,
// reading time, table of contents, media uses and one hash per translation segment. Pure and cheap; code blocks
// are never words nor segments (ADR-0009 §3)
import type { Locale, MediaUsageContext } from '../types/enums.ts'
import { contentHash } from './canonical-json.ts'
import type { BlockNode, DocumentJson, InlineNode } from './document-schema.ts'

export const WORDS_PER_MINUTE = 220

export interface TocEntry {
  id: string
  level: 2 | 3
  text: string
}

export interface MediaUse {
  mediaId: string
  context: MediaUsageContext
}

export interface DerivedDocument {
  plainText: string
  wordCount: number
  readingTimeMin: number
  toc: TocEntry[]
  mediaUsages: MediaUse[]
}

// Blocks and the nodes between them (list items, table rows and cells)
interface AnyNode {
  type: string
  content?: unknown[] | undefined
}

/** The text of inline content, a hard break counting as a space */
export function inlineText(content: InlineNode[] | undefined): string {
  return (content ?? []).map(node => (node.type === 'text' ? node.text : ' ')).join('')
}

/** Every block in document order, nested ones included */
function* blocks(nodes: readonly AnyNode[]): Generator<AnyNode> {
  for (const node of nodes) {
    yield node
    if (node.type !== 'paragraph' && node.type !== 'heading' && node.content) {
      yield* blocks(node.content as AnyNode[])
    }
  }
}

/** Prose that readers read: text blocks plus captions and embed titles, one per line */
function proseLines(doc: DocumentJson): string[] {
  const lines: string[] = []
  for (const node of blocks(doc.content)) {
    const block = node as BlockNode
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        lines.push(inlineText(block.content))
        break
      case 'image':
      case 'video':
        lines.push(block.attrs.caption ?? '')
        break
      case 'embed':
        lines.push(block.attrs.title)
        break
    }
  }
  return lines.filter(line => line.trim() !== '')
}

export function countWords(text: string, locale: Locale): number {
  let words = 0
  for (const segment of new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)) {
    if (segment.isWordLike) {
      words++
    }
  }
  return words
}

export function readingTimeMin(words: number): number {
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

const USAGE_ORDER: Record<string, number> = { body: 0, gallery: 1, poster: 2 }

export function deriveDocument(doc: DocumentJson, locale: Locale): DerivedDocument {
  const plainText = proseLines(doc).join('\n')
  const wordCount = countWords(plainText, locale)
  const toc: TocEntry[] = []
  const uses = new Map<string, MediaUse>()
  const use = (mediaId: string, context: MediaUsageContext) => uses.set(`${mediaId}:${context}`, { mediaId, context })

  for (const node of blocks(doc.content)) {
    const block = node as BlockNode
    switch (block.type) {
      case 'heading':
        if (block.attrs.level <= 3) {
          toc.push({ id: block.attrs.id, level: block.attrs.level as 2 | 3, text: inlineText(block.content).trim() })
        }
        break
      case 'image':
      case 'video':
        use(block.attrs.mediaId, 'body')
        break
      case 'gallery':
        block.attrs.items.forEach(mediaId => use(mediaId, 'gallery'))
        break
      case 'embed':
        use(block.attrs.posterMediaId, 'poster')
        break
    }
  }
  const mediaUsages = [...uses.values()].sort((a, b) => USAGE_ORDER[a.context]! - USAGE_ORDER[b.context]! || (a.mediaId < b.mediaId ? -1 : a.mediaId > b.mediaId ? 1 : 0))
  return { plainText, wordCount, readingTimeMin: readingTimeMin(wordCount), toc, mediaUsages }
}

/**
 * What each translation segment is made of, by segment id: the inline content (text and marks) of every text
 * block, a caption, alt override or embed title as `{blockId}:{attribute}`, and localized fields as `field:{name}`
 */
export function segmentSources(doc: DocumentJson, fields: Record<string, string | null | undefined> = {}): Map<string, unknown> {
  const sources = new Map<string, unknown>()
  const add = (id: string, value: string | null | undefined) => {
    if (value && value.trim() !== '') {
      sources.set(id, value)
    }
  }
  for (const [name, value] of Object.entries(fields)) {
    add(`field:${name}`, value)
  }
  for (const node of blocks(doc.content)) {
    const block = node as BlockNode
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        if (inlineText(block.content).trim() !== '') {
          sources.set(block.attrs.id, block.content)
        }
        break
      case 'image':
        add(`${block.attrs.id}:caption`, block.attrs.caption)
        add(`${block.attrs.id}:alt`, block.attrs.altOverride)
        break
      case 'video':
        add(`${block.attrs.id}:caption`, block.attrs.caption)
        break
      case 'embed':
        add(`${block.attrs.id}:title`, block.attrs.title)
        break
    }
  }
  return sources
}

/** SHA-256 of each segment's canonical source: a segment is outdated when its hash changes (ADR-0009 §7) */
export async function segmentHashes(doc: DocumentJson, fields: Record<string, string | null | undefined> = {}): Promise<Record<string, string>> {
  const entries = await Promise.all([...segmentSources(doc, fields)].map(async ([id, source]) => [id, await contentHash(source)] as const))
  return Object.fromEntries(entries)
}
