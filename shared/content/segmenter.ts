// The document segmenter (F09-T2, ADR-0009 §3). Extracts what a translation needs, as tagged text (inline-tags.ts):
// every paragraph and heading wherever it sits (lists, quotes, callouts, table cells), and the texts kept in block
// attributes (an image's caption and alt override, a video's caption, an embed's title). Code blocks, galleries,
// rules, URLs and protected terms are never sent. A segment id starts with its top-level block, `block:<id>`, the
// segment F09-T1 tracks, so an outdated block names the segments to translate again. Reinserting checks each
// translation's tags and keeps the original where they do not match; the result is a valid document again
import type { DocumentJson } from './document-schema.ts'
import { documentSchema } from './document-schema.ts'
import type { InlineNode, ProtectedTerm, TaggedText } from './inline-tags.ts'
import { tagInline, tagPlainText, untagInline, untagPlainText } from './inline-tags.ts'

export interface Segment {
  id: string
  /** The tagged text to translate */
  text: string
}

interface InlineEntry { kind: 'inline', id: string, path: (string | number)[], tagged: TaggedText }
interface AttrEntry { kind: 'attr', id: string, path: (string | number)[], attr: string, tagged: TaggedText }
type Entry = InlineEntry | AttrEntry

/** What reinserting needs: where each segment came from and what its tagged text left out */
export interface Extraction {
  entries: Entry[]
}

interface NodeLike {
  type: string
  attrs?: Record<string, unknown>
  content?: NodeLike[]
}

const INLINE_CONTAINERS = new Set(['paragraph', 'heading'])
// Texts kept in attributes, by node type; none of them carries marks
const TEXT_ATTRS: Record<string, readonly { attr: string, suffix: string }[]> = {
  image: [{ attr: 'caption', suffix: 'caption' }, { attr: 'altOverride', suffix: 'alt' }],
  video: [{ attr: 'caption', suffix: 'caption' }],
  embed: [{ attr: 'title', suffix: 'title' }],
}

function visit(node: NodeLike, path: (string | number)[], top: string, isTop: boolean, terms: readonly ProtectedTerm[], entries: Entry[]): void {
  const ownId = typeof node.attrs?.id === 'string' ? node.attrs.id : undefined
  if (INLINE_CONTAINERS.has(node.type)) {
    const content = (node.content ?? []) as InlineNode[]
    if (content.some(item => item.type === 'text')) {
      const id = isTop ? top : `${top}/${ownId ?? path.join('.')}`
      entries.push({ kind: 'inline', id, path, tagged: tagInline(content, terms) })
    }
    return
  }
  for (const { attr, suffix } of TEXT_ATTRS[node.type] ?? []) {
    const value = node.attrs?.[attr]
    if (typeof value === 'string' && value.trim() !== '') {
      entries.push({ kind: 'attr', id: `${top}/${suffix}`, path, attr, tagged: tagPlainText(value, terms) })
    }
  }
  // Code blocks keep their code in attributes and are skipped with everything else that has no text
  node.content?.forEach((child, index) => visit(child, [...path, 'content', index], top, false, terms, entries))
}

/** The segments of a document, in reading order, and what reinserting them needs */
export function extractDocument(document: DocumentJson, terms: readonly ProtectedTerm[] = []): { segments: Segment[], extraction: Extraction } {
  const entries: Entry[] = []
  ;(document.content as NodeLike[]).forEach((block, index) => {
    const id = typeof block.attrs?.id === 'string' ? block.attrs.id : `#${index}`
    visit(block, ['content', index], `block:${id}`, true, terms, entries)
  })
  return { segments: entries.map(entry => ({ id: entry.id, text: entry.tagged.text })), extraction: { entries } }
}

function at(root: unknown, path: readonly (string | number)[]): NodeLike {
  return path.reduce<unknown>((node, key) => (node as Record<string | number, unknown>)[key], root) as NodeLike
}

export interface ReinsertResult {
  document: DocumentJson
  /** Segments whose translation was refused (tags changed, or it came back empty); they keep the source text */
  failed: string[]
}

/**
 * The document with the translations put back. A missing translation leaves its segment as it was; a failed one too,
 * and it is listed. The original document is never changed
 */
export function reinsertDocument(document: DocumentJson, extraction: Extraction, translations: Readonly<Record<string, string>>): ReinsertResult {
  const next = structuredClone(document)
  const failed: string[] = []
  for (const entry of extraction.entries) {
    const translated = translations[entry.id]
    if (translated === undefined) {
      continue
    }
    const node = at(next, entry.path)
    if (entry.kind === 'inline') {
      const result = untagInline(translated, entry.tagged)
      if (result.ok) {
        node.content = result.content as NodeLike[]
      }
      else {
        failed.push(entry.id)
      }
    }
    else {
      const result = untagPlainText(translated, entry.tagged)
      if (result.ok) {
        node.attrs = { ...node.attrs, [entry.attr]: result.text }
      }
      else {
        failed.push(entry.id)
      }
    }
  }
  // Every accepted translation keeps the structure; a document the schema refuses would be a bug here, never saved
  return { document: documentSchema.parse(next) as DocumentJson, failed }
}

/** A plain field (title, excerpt, SEO, a topic's name) as one segment: only protected terms become placeholders */
export function extractField(id: string, text: string, terms: readonly ProtectedTerm[] = []): { segment: Segment, tagged: TaggedText } {
  const tagged = tagPlainText(text, terms)
  return { segment: { id, text: tagged.text }, tagged }
}

export function reinsertField(translated: string, tagged: TaggedText): { ok: true, text: string } | { ok: false } {
  const result = untagPlainText(translated, tagged)
  return result.ok ? result : { ok: false }
}
