// Source segments and their hashes (F09-T1, ADR-0009 §3 and §7, data-model §8). A segment is one translatable unit of
// the pt-BR original: a field (title, excerpt, SEO…) or a top-level block of a document, by its stable id (UniqueID).
// A translation keeps, per segment, the hash of the source it was approved against (segments_meta); comparing them
// with the current hashes tells which segments changed. Slugs, URLs and choices (a page link target, a date) are not
// segments: they are never translated text. The F09-T2 segmenter splits these same segments for the AI
import type { z } from 'zod'
import type { DocumentJson } from './document-schema.ts'
import { canonicalJson, contentHash } from './canonical-json.ts'
import type { segmentsMeta } from './snapshot.ts'

export type SegmentsMeta = z.output<typeof segmentsMeta>
/** Segment id → its canonical source text */
export type Segments = Record<string, string>

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

function add(segments: Segments, id: string, value: unknown): void {
  const content = text(value)
  if (content) {
    segments[id] = content
  }
}

/** Each top-level block of a document, by its id (by position when it has none), as canonical JSON */
function addDocument(segments: Segments, prefix: string, document: DocumentJson | null | undefined): void {
  for (const [index, block] of (document?.content ?? []).entries()) {
    const id = (block.attrs as { id?: unknown } | undefined)?.id
    segments[`${prefix}block:${typeof id === 'string' ? id : `#${index}`}`] = canonicalJson(block)
  }
}

const SEO_FIELDS = ['seoTitle', 'seoDescription'] as const

export function articleSegments(copy: { title?: unknown, excerpt?: unknown, seoTitle?: unknown, seoDescription?: unknown, body?: DocumentJson | null }): Segments {
  const segments: Segments = {}
  add(segments, 'title', copy.title)
  add(segments, 'excerpt', copy.excerpt)
  for (const field of SEO_FIELDS) {
    add(segments, field, copy[field])
  }
  addDocument(segments, '', copy.body)
  return segments
}

export function projectSegments(copy: { title?: unknown, summary?: unknown, role?: unknown, seoTitle?: unknown, seoDescription?: unknown, highlights?: readonly { label: string, value: string, note?: string | undefined }[] | null, body?: DocumentJson | null }): Segments {
  const segments: Segments = {}
  add(segments, 'title', copy.title)
  add(segments, 'summary', copy.summary)
  add(segments, 'role', copy.role)
  for (const field of SEO_FIELDS) {
    add(segments, field, copy[field])
  }
  for (const [index, highlight] of (copy.highlights ?? []).entries()) {
    add(segments, `highlights.${index}.label`, highlight.label)
    add(segments, `highlights.${index}.value`, highlight.value)
    add(segments, `highlights.${index}.note`, highlight.note)
  }
  addDocument(segments, '', copy.body)
  return segments
}

// Page block fields that are choices or data, not text
const PAGE_NON_TEXT = new Set(['target', 'updatedOn', 'url'])

function isDocument(value: unknown): value is DocumentJson {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'doc'
}

function walkBlocks(segments: Segments, path: string, value: unknown): void {
  if (isDocument(value)) {
    addDocument(segments, `${path}:`, value)
  }
  else if (Array.isArray(value)) {
    value.forEach((item, index) => walkBlocks(segments, `${path}.${index}`, item))
  }
  else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (!PAGE_NON_TEXT.has(key)) {
        walkBlocks(segments, path ? `${path}.${key}` : key, item)
      }
    }
  }
  else {
    add(segments, path, value)
  }
}

/** Every text field of a page's blocks by its path (`hero.title`, `timeline.2.text`), documents by block */
export function pageSegments(copy: { blocks?: unknown, seoTitle?: unknown, seoDescription?: unknown }): Segments {
  const segments: Segments = {}
  walkBlocks(segments, 'blocks', copy.blocks ?? {})
  for (const field of SEO_FIELDS) {
    add(segments, field, copy[field])
  }
  return segments
}

/** Short fields (a topic's name, a media item's alt, a setting's localized value): each field is a segment */
export function fieldSegments(fields: Record<string, unknown> | null | undefined): Segments {
  const segments: Segments = {}
  for (const [key, value] of Object.entries(fields ?? {})) {
    add(segments, key, value)
  }
  return segments
}

/** Segment id → SHA-256 of its text */
export async function hashSegments(segments: Segments): Promise<Record<string, string>> {
  const entries = await Promise.all(Object.entries(segments).map(async ([id, value]) => [id, await contentHash(value)] as const))
  return Object.fromEntries(entries)
}

/** The meta of a translation approved against these source hashes: every segment approved */
export function approvedMeta(hashes: Record<string, string>): SegmentsMeta {
  return Object.fromEntries(Object.entries(hashes).map(([id, sourceHash]) => [id, { sourceHash, state: 'approved' as const }]))
}

export interface SegmentComparison {
  meta: SegmentsMeta
  /** Segments whose source changed, appeared or disappeared since the translation was approved */
  changed: string[]
}

/**
 * Compares a translation's meta with the current source hashes. A segment whose hash differs, or that is new in the
 * source, becomes `outdated` (its stored hash stays the one it was approved against, for the diff); one that left the
 * source leaves the meta. Unchanged segments keep their state. Nothing changed → the same meta and no ids
 */
export function compareSegments(meta: SegmentsMeta, hashes: Record<string, string>): SegmentComparison {
  const next: SegmentsMeta = {}
  const changed: string[] = []
  for (const [id, sourceHash] of Object.entries(hashes)) {
    const current = meta[id]
    if (current && current.sourceHash === sourceHash) {
      next[id] = current
    }
    else {
      next[id] = { sourceHash: current?.sourceHash ?? '', state: 'outdated' }
      changed.push(id)
    }
  }
  for (const id of Object.keys(meta)) {
    if (!(id in hashes)) {
      changed.push(id)
    }
  }
  return { meta: next, changed }
}
