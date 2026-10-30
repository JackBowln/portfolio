// Admin-only. What changed between two versions of an article (F06-T2, ADR-0006 §6), computed in the browser: the
// fields (title, slug, SEO, cover, topics…) and the body block by block, matched by their stable `id` (added,
// removed, changed, moved), with a word diff inside changed blocks. Pure, so it is unit-tested; jsdiff does the
// sequence work (Myers), which stays fast on long text and code
import { diffArrays, diffWordsWithSpace } from 'diff'
import { canonicalJson } from '#shared/content/canonical-json'
import type { BlockNode, DocumentJson } from '#shared/content/document-schema'
import { inlineText } from '#shared/content/derive'

/** The fields of a version that the diff compares, as a snapshot holds them */
export interface VersionFields {
  title: string
  slug: string
  excerpt: string
  seoTitle: string | null
  seoDescription: string | null
  ogImageMediaId: string | null
  noindex: boolean
  coverMediaId: string | null
  tagIds: string[]
  body: DocumentJson
}

export const DIFF_FIELDS = ['title', 'slug', 'excerpt', 'seoTitle', 'seoDescription', 'noindex', 'coverMediaId', 'ogImageMediaId', 'tagIds'] as const
export type DiffField = (typeof DIFF_FIELDS)[number]

export interface FieldChange {
  field: DiffField
  before: VersionFields[DiffField]
  after: VersionFields[DiffField]
}

export interface WordPart {
  value: string
  added: boolean
  removed: boolean
}

export interface BlockChange {
  id: string
  type: string
  status: 'added' | 'removed' | 'changed' | 'moved' | 'same'
  /** Readable text of the block before and after (text, code, caption or title) */
  before: string
  after: string
  /** Word diff of the text, for a changed block whose text changed */
  words: WordPart[] | null
}

interface AnyNode {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  content?: AnyNode[]
}

/** The text a reader sees in a block, nested blocks joined by line breaks */
export function blockText(block: BlockNode | AnyNode): string {
  const node = block as AnyNode
  const attrs = node.attrs ?? {}
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return inlineText(node.content as never)
    case 'codeBlock':
      return String(attrs.code ?? '')
    case 'image':
    case 'video':
      return String(attrs.caption ?? '')
    case 'embed':
      return String(attrs.title ?? '')
    default:
      return (node.content ?? []).map(blockText).filter(text => text !== '').join('\n')
  }
}

const same = (a: unknown, b: unknown) => canonicalJson(a ?? null) === canonicalJson(b ?? null)

export function diffFields(before: VersionFields, after: VersionFields): FieldChange[] {
  return DIFF_FIELDS.filter(field => !same(before[field], after[field])).map(field => ({ field, before: before[field], after: after[field] }))
}

function wordsOf(before: string, after: string): WordPart[] | null {
  if (before === after) {
    return null
  }
  return diffWordsWithSpace(before, after).map(part => ({ value: part.value, added: !!part.added, removed: !!part.removed }))
}

/** Blocks in reading order: the new document's, with removed blocks where they used to be */
export function diffBlocks(before: DocumentJson, after: DocumentJson): BlockChange[] {
  const old = new Map(before.content.map(block => [block.attrs.id, block]))
  const next = new Map(after.content.map(block => [block.attrs.id, block]))
  const changes: BlockChange[] = []
  const entry = (id: string, status: BlockChange['status']): BlockChange => {
    const was = old.get(id)
    const now = next.get(id)
    const beforeText = was ? blockText(was) : ''
    const afterText = now ? blockText(now) : ''
    return {
      id,
      type: (now ?? was)!.type,
      status,
      before: beforeText,
      after: afterText,
      words: status === 'changed' || status === 'moved' ? wordsOf(beforeText, afterText) : null,
    }
  }
  for (const part of diffArrays(before.content.map(block => block.attrs.id), after.content.map(block => block.attrs.id))) {
    for (const id of part.value) {
      if (part.removed) {
        // A block that only moved is listed where it is now
        if (!next.has(id)) {
          changes.push(entry(id, 'removed'))
        }
      }
      else if (part.added) {
        changes.push(entry(id, old.has(id) ? 'moved' : 'added'))
      }
      else {
        changes.push(entry(id, same(old.get(id), next.get(id)) ? 'same' : 'changed'))
      }
    }
  }
  return changes
}

export interface VersionDiff {
  fields: FieldChange[]
  blocks: BlockChange[]
  /** True when nothing differs */
  identical: boolean
}

export function diffVersions(before: VersionFields, after: VersionFields): VersionDiff {
  const fields = diffFields(before, after)
  const blocks = diffBlocks(before.body, after.body)
  return { fields, blocks, identical: fields.length === 0 && blocks.every(block => block.status === 'same') }
}
