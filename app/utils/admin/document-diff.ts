// Admin-only. What changed between two versions of an article or a project (F06-T2, F07-T1, ADR-0006 §6), computed
// in the browser: the fields (title, slug, SEO, cover, topics…; each type lists its own) and the body block by block, matched by their stable `id` (added,
// removed, changed, moved), with a word diff inside changed blocks. Pure, so it is unit-tested; jsdiff does the
// sequence work (Myers), which stays fast on long text and code
import { diffArrays, diffWordsWithSpace } from 'diff'
import { canonicalJson } from '#shared/content/canonical-json'
import type { BlockNode, DocumentJson } from '#shared/content/document-schema'
import { inlineText } from '#shared/content/derive'

/** Any version: a body and the fields its type compares, as a snapshot holds them (localization and entity) */
export interface AnyVersionFields {
  body: DocumentJson
  [field: string]: unknown
}

/** An article's version */
export interface VersionFields extends AnyVersionFields {
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

/** A project's fields, in the order the diff lists them (F07-T1) */
export const PROJECT_DIFF_FIELDS = [
  'title', 'slug', 'summary', 'role', 'highlights', 'periodStart', 'periodEnd', 'repoUrl', 'demoUrl',
  'technologyIds', 'coverMediaId', 'galleryMediaIds', 'seoTitle', 'seoDescription', 'noindex', 'ogImageMediaId',
] as const

/** A field of the compared version: an article's or project's (above), or a page's blocks and SEO (F08-T2) */
export type DiffField = string

export interface FieldChange {
  field: DiffField
  before: unknown
  after: unknown
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

export function diffFields(before: AnyVersionFields, after: AnyVersionFields, fields: readonly DiffField[] = DIFF_FIELDS): FieldChange[] {
  return fields.filter(field => !same(before[field], after[field])).map(field => ({ field, before: before[field], after: after[field] }))
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

export function diffVersions(before: AnyVersionFields, after: AnyVersionFields, compared: readonly DiffField[] = DIFF_FIELDS): VersionDiff {
  const fields = diffFields(before, after, compared)
  const blocks = diffBlocks(before.body, after.body)
  return { fields, blocks, identical: fields.length === 0 && blocks.every(block => block.status === 'same') }
}
