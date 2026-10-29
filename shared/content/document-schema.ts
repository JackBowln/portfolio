// The document (ADR-0006 §2): the one definition the editor, the server, the renderer and the translation
// segmenter share. Tiptap/ProseMirror JSON, strict at every level: an unknown node, mark or attribute is an error,
// never dropped. Every block carries a stable `id` (UniqueID) for anchors, diffs, media uses and translation
// segments. A change here follows .claude/skills/cms-engineer/references/new-node-checklist.md
import { z } from 'zod'
import { isUuidv7 } from '../utils/id.ts'
import { hastIssues, hastText } from './hast.ts'
import type { HastElement } from './hast.ts'
import { MAX_HREF_LENGTH, contentHref } from './url.ts'

export const CURRENT_SCHEMA_VERSION = 1

export const DOCUMENT_LIMITS = {
  /** JSON characters; a localization row holds the body and the published snapshot, under D1's 2 MB row */
  size: 512 * 1024,
  nodes: 5000,
  depth: 12,
  codeLength: 32 * 1024,
  shortText: 500,
} as const

export const EMBED_PROVIDERS = ['youtube', 'vimeo'] as const
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number]
/** IDs as the providers issue them; the URL parser of F05-T5 produces these */
export const EMBED_ID_PATTERNS: Record<EmbedProvider, RegExp> = {
  youtube: /^[\w-]{11}$/,
  vimeo: /^\d{1,12}$/,
}

export const GALLERY_LAYOUTS = ['grid', 'stack'] as const
export const CALLOUT_TONES = ['info', 'tip', 'warning', 'danger'] as const
export const HEADING_LEVELS = [2, 3, 4] as const

const blockId = z.string().regex(/^[\w-]{1,64}$/, 'block id must be 1–64 letters, digits, _ or -')
const mediaId = z.string().refine(isUuidv7, 'must be a media id (UUIDv7)')
const shortText = z.string().max(DOCUMENT_LIMITS.shortText)
const optionalText = shortText.nullable().optional()
const idAttrs = z.strictObject({ id: blockId })

// Marks

const href = z.string().max(MAX_HREF_LENGTH).refine(value => contentHref(value) !== undefined, 'link must be https:, http:, mailto: or a path on this site')
const mark = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('bold') }),
  z.strictObject({ type: z.literal('italic') }),
  z.strictObject({ type: z.literal('strike') }),
  z.strictObject({ type: z.literal('code') }),
  // rel and target are derived when rendering, never stored
  z.strictObject({ type: z.literal('link'), attrs: z.strictObject({ href }) }),
])

// Inline

const text = z.strictObject({
  type: z.literal('text'),
  text: z.string().min(1, 'text must not be empty'),
  marks: z.array(mark).max(5).refine(marks => new Set(marks.map(item => item.type)).size === marks.length, 'a mark appears twice').optional(),
})
const inline = z.discriminatedUnion('type', [text, z.strictObject({ type: z.literal('hardBreak') })])
const inlineContent = z.array(inline).optional()

// Text blocks

const paragraph = z.strictObject({ type: z.literal('paragraph'), attrs: idAttrs, content: inlineContent })
const heading = z.strictObject({
  type: z.literal('heading'),
  attrs: z.strictObject({ id: blockId, level: z.literal(HEADING_LEVELS) }),
  content: inlineContent,
})

// Lists nest, so their types are written out for the recursive schemas
type Paragraph = z.output<typeof paragraph>
export interface ListItem { type: 'listItem', content: [Paragraph, ...(Paragraph | BulletList | OrderedList)[]] }
export interface BulletList { type: 'bulletList', attrs: { id: string }, content: ListItem[] }
export interface OrderedList { type: 'orderedList', attrs: { id: string, start: number }, content: ListItem[] }

const listItem: z.ZodType<ListItem> = z.strictObject({
  type: z.literal('listItem'),
  content: z.tuple([paragraph], z.lazy(() => z.discriminatedUnion('type', [paragraph, bulletList, orderedList]))),
})
const bulletList = z.strictObject({ type: z.literal('bulletList'), attrs: idAttrs, content: z.array(listItem).min(1) })
const orderedList = z.strictObject({
  type: z.literal('orderedList'),
  attrs: z.strictObject({ id: blockId, start: z.int().min(1) }),
  content: z.array(listItem).min(1),
})
const textBlocks = z.array(z.discriminatedUnion('type', [paragraph, bulletList, orderedList])).min(1)

const blockquote = z.strictObject({ type: z.literal('blockquote'), attrs: idAttrs, content: textBlocks })
const callout = z.strictObject({
  type: z.literal('callout'),
  attrs: z.strictObject({ id: blockId, tone: z.enum(CALLOUT_TONES) }),
  content: textBlocks,
})
const horizontalRule = z.strictObject({ type: z.literal('horizontalRule'), attrs: idAttrs })

// Code: Shiki's HAST is made in the admin browser; it must show exactly the stored code

const codeBlock = z.strictObject({
  type: z.literal('codeBlock'),
  attrs: z.strictObject({
    id: blockId,
    language: z.string().regex(/^[a-z0-9+#-]{1,32}$/, 'language must be a lowercase Shiki language id'),
    code: z.string().max(DOCUMENT_LIMITS.codeLength),
    hast: z.unknown(),
  }).superRefine((attrs, context) => {
    const issues = hastIssues(attrs.hast)
    for (const issue of issues) {
      context.addIssue({ code: 'custom', path: ['hast', ...issue.path], message: issue.message })
    }
    if (issues.length === 0 && hastText(attrs.hast as HastElement) !== attrs.code) {
      context.addIssue({ code: 'custom', path: ['hast'], message: 'the highlighted text differs from the code' })
    }
  }),
})

// Media: alt, poster and caption tracks live on the media row (ADR-0007); the node only points at it

const image = z.strictObject({
  type: z.literal('image'),
  attrs: z.strictObject({ id: blockId, mediaId, caption: optionalText, altOverride: optionalText }),
})
const gallery = z.strictObject({
  type: z.literal('gallery'),
  attrs: z.strictObject({ id: blockId, items: z.array(mediaId).min(2).max(24), layout: z.enum(GALLERY_LAYOUTS) }),
})
const video = z.strictObject({ type: z.literal('video'), attrs: z.strictObject({ id: blockId, mediaId, caption: optionalText }) })
const embed = z.strictObject({
  type: z.literal('embed'),
  attrs: z.strictObject({
    id: blockId,
    provider: z.enum(EMBED_PROVIDERS),
    externalId: z.string(),
    title: z.string().trim().min(1, 'an embed needs a title').max(200),
    posterMediaId: mediaId,
  }).refine(attrs => EMBED_ID_PATTERNS[attrs.provider].test(attrs.externalId), { path: ['externalId'], message: 'not a valid id for this provider' }),
})

// Simple tables: Tiptap's default cell attributes are accepted, merged or sized cells are not

const cellAttrs = z.strictObject({ colspan: z.literal(1), rowspan: z.literal(1), colwidth: z.null() }).partial().optional()
const cell = (type: 'tableHeader' | 'tableCell') => z.strictObject({ type: z.literal(type), attrs: cellAttrs, content: z.array(paragraph).min(1) })
const tableRow = z.strictObject({ type: z.literal('tableRow'), content: z.array(z.discriminatedUnion('type', [cell('tableHeader'), cell('tableCell')])).min(1) })
const table = z.strictObject({ type: z.literal('table'), attrs: idAttrs, content: z.array(tableRow).min(1) })

export const blockNode = z.discriminatedUnion('type', [
  paragraph,
  heading,
  bulletList,
  orderedList,
  blockquote,
  callout,
  horizontalRule,
  codeBlock,
  image,
  gallery,
  video,
  embed,
  table,
])

const docObject = z.strictObject({
  type: z.literal('doc'),
  attrs: z.strictObject({ schemaVersion: z.literal(CURRENT_SCHEMA_VERSION) }).optional(),
  content: z.array(blockNode),
}).superRefine((doc, context) => {
  const seen = new Map<string, string>()
  walk(doc, (node, path) => {
    const id = (node.attrs as { id?: unknown } | undefined)?.id
    if (typeof id !== 'string') {
      return
    }
    if (seen.has(id)) {
      context.addIssue({ code: 'custom', path: [...path, 'attrs', 'id'], message: `block id "${id}" is already used at ${seen.get(id)}` })
    }
    else {
      seen.set(id, path.join('.'))
    }
  })
})

interface NodeLike {
  type?: unknown
  attrs?: unknown
  content?: unknown
}

/** Visits the document's nodes depth first, with their path; stops descending past `maxDepth` */
function walk(root: NodeLike, visit: (node: NodeLike, path: (string | number)[], depth: number) => void, maxDepth = Infinity): void {
  const go = (node: NodeLike, path: (string | number)[], depth: number) => {
    visit(node, path, depth)
    if (depth < maxDepth && Array.isArray(node.content)) {
      node.content.forEach((child: unknown, index) => {
        if (typeof child === 'object' && child !== null) {
          go(child as NodeLike, [...path, 'content', index], depth + 1)
        }
      })
    }
  }
  go(root, [], 1)
}

/** Size, node count and depth, checked before the full parse so a huge payload costs little CPU */
const limits = z.unknown().superRefine((input, context) => {
  let size: number
  try {
    size = JSON.stringify(input)?.length ?? 0
  }
  catch {
    context.addIssue({ code: 'custom', message: 'the document is not JSON' })
    return
  }
  if (size > DOCUMENT_LIMITS.size) {
    context.addIssue({ code: 'custom', message: `the document has ${size} characters, more than ${DOCUMENT_LIMITS.size}` })
    return
  }
  if (typeof input !== 'object' || input === null) {
    return
  }
  let nodes = 0
  let deepest = 0
  walk(input as NodeLike, (_node, _path, depth) => {
    nodes++
    deepest = Math.max(deepest, depth)
  }, DOCUMENT_LIMITS.depth + 1)
  if (nodes > DOCUMENT_LIMITS.nodes) {
    context.addIssue({ code: 'custom', message: `the document has ${nodes} nodes, more than ${DOCUMENT_LIMITS.nodes}` })
  }
  if (deepest > DOCUMENT_LIMITS.depth) {
    context.addIssue({ code: 'custom', message: `the document is nested deeper than ${DOCUMENT_LIMITS.depth} levels` })
  }
})

export const documentSchema = limits.pipe(docObject)
export type DocumentJson = z.output<typeof documentSchema>
export type BlockNode = z.output<typeof blockNode>
export type InlineNode = z.output<typeof inline>
export type Mark = z.output<typeof mark>

export interface DocumentIssue {
  path: string
  message: string
}

export type DocumentValidation = { ok: true, doc: DocumentJson } | { ok: false, issues: DocumentIssue[] }

/** For API errors and the editor: every problem with its JSON path ("content.2.attrs.href") */
export function validateDocument(input: unknown): DocumentValidation {
  const result = documentSchema.safeParse(input)
  if (result.success) {
    return { ok: true, doc: result.data }
  }
  return { ok: false, issues: result.error.issues.map(issue => ({ path: issue.path.map(String).join('.'), message: issue.message })) }
}
