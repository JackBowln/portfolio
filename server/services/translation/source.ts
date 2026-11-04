// What a translation job sends, per content type (F09-T3): the pt-BR copy's text fields and documents, segmented
// with the glossary's protected terms (segmenter.ts), and how the translated segments become the target copy's
// values again. Only these content fields are ever read: nothing from contact messages, users or settings secrets
import type { DocumentJson } from '../../../shared/content/document-schema.ts'
import type { ProtectedTerm, TaggedText } from '../../../shared/content/inline-tags.ts'
import { untagInline } from '../../../shared/content/inline-tags.ts'
import { PAGE_NON_TEXT } from '../../../shared/content/segment-hash.ts'
import type { Extraction, Segment } from '../../../shared/content/segmenter.ts'
import { extractDocument, extractField, reinsertDocument, reinsertField } from '../../../shared/content/segmenter.ts'
import type { ContentType } from '../../../shared/content/snapshot.ts'

type Path = (string | number)[]

interface FieldPart { id: string, path: Path, text: string }
interface DocumentPart { prefix: string, path: Path, document: DocumentJson }

const SEO = ['seoTitle', 'seoDescription'] as const

function isDocument(value: unknown): value is DocumentJson {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'doc'
}

function walkBlocks(value: unknown, path: Path, id: string, fields: FieldPart[], documents: DocumentPart[]): void {
  if (isDocument(value)) {
    documents.push({ prefix: `${id}:`, path, document: value })
  }
  else if (Array.isArray(value)) {
    value.forEach((item, index) => walkBlocks(item, [...path, index], `${id}.${index}`, fields, documents))
  }
  else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (!PAGE_NON_TEXT.has(key)) {
        walkBlocks(item, [...path, key], `${id}.${key}`, fields, documents)
      }
    }
  }
  else if (typeof value === 'string' && value.trim() !== '') {
    fields.push({ id, path, text: value })
  }
}

/** The translatable parts of a pt-BR copy, with the same segment ids as segment-hash.ts (F09-T1) */
export function sourceParts(type: ContentType, copy: Record<string, unknown>): { fields: FieldPart[], documents: DocumentPart[] } {
  const fields: FieldPart[] = []
  const documents: DocumentPart[] = []
  const field = (name: string, path: Path = [name]) => {
    const value = path.reduce<unknown>((node, key) => (node as Record<string | number, unknown> | undefined)?.[key], copy)
    if (typeof value === 'string' && value.trim() !== '') {
      fields.push({ id: path.join('.'), path, text: value })
    }
  }
  if (type === 'page') {
    walkBlocks(copy.blocks ?? {}, ['blocks'], 'blocks', fields, documents)
  }
  else {
    field('title')
    if (type === 'article') {
      field('excerpt')
    }
    else {
      field('summary')
      field('role')
      for (const [index] of ((copy.highlights as unknown[] | null) ?? []).entries()) {
        for (const key of ['label', 'value', 'note']) {
          field(key, ['highlights', index, key])
        }
      }
    }
    if (isDocument(copy.body)) {
      documents.push({ prefix: '', path: ['body'], document: copy.body })
    }
  }
  for (const name of SEO) {
    field(name)
  }
  return { fields, documents }
}

export interface SegmentedSource {
  segments: Segment[]
  /** The target copy's values from the translated segments; a segment without a valid translation keeps the source */
  rebuild: (translations: Readonly<Record<string, string>>) => { values: Record<string, unknown>, failed: string[] }
  /** Whether a translated text keeps the tags of its segment (checked as each batch comes back) */
  accepts: (id: string, text: string) => boolean
}

function setAt(target: Record<string, unknown>, path: Path, value: unknown): void {
  let node = target as Record<string | number, unknown>
  for (const key of path.slice(0, -1)) {
    node = node[key] as Record<string | number, unknown>
  }
  node[path.at(-1)!] = value
}

export function segmentSource(type: ContentType, copy: Record<string, unknown>, terms: readonly ProtectedTerm[]): SegmentedSource {
  const { fields, documents } = sourceParts(type, copy)
  const tagged = new Map<string, TaggedText>()
  const segments: Segment[] = []
  for (const part of fields) {
    const { segment, tagged: text } = extractField(part.id, part.text, terms)
    tagged.set(part.id, text)
    segments.push(segment)
  }
  const extractions: { part: DocumentPart, extraction: Extraction }[] = []
  for (const part of documents) {
    const { segments: inner, extraction } = extractDocument(part.document, terms)
    extractions.push({ part, extraction })
    for (const entry of extraction.entries) {
      tagged.set(`${part.prefix}${entry.id}`, entry.tagged)
    }
    segments.push(...inner.map(segment => ({ id: `${part.prefix}${segment.id}`, text: segment.text })))
  }

  return {
    segments,
    accepts: (id, text) => {
      const source = tagged.get(id)
      return source !== undefined && untagInline(text, source).ok
    },
    rebuild: (translations) => {
      const values = structuredClone(Object.fromEntries(['title', 'excerpt', 'summary', 'role', 'highlights', 'blocks', ...SEO].filter(key => key in copy).map(key => [key, copy[key]])))
      const failed: string[] = []
      for (const part of fields) {
        const translated = translations[part.id]
        if (translated === undefined) {
          continue
        }
        const result = reinsertField(translated, tagged.get(part.id)!)
        if (result.ok) {
          setAt(values, part.path, result.text)
        }
        else {
          failed.push(part.id)
        }
      }
      for (const { part, extraction } of extractions) {
        const inner = Object.fromEntries(Object.entries(translations).filter(([id]) => id.startsWith(part.prefix)).map(([id, text]) => [id.slice(part.prefix.length), text]))
        const result = reinsertDocument(part.document, extraction, inner)
        failed.push(...result.failed.map(id => `${part.prefix}${id}`))
        if (part.path[0] === 'body') {
          values.body = result.document
        }
        else {
          setAt(values, part.path, result.document)
        }
      }
      return { values, failed }
    },
  }
}
