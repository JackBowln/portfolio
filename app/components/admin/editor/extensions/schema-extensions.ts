// The editor's extensions, configured so getJSON() is exactly the shape of shared/content/document-schema.ts
// (ADR-0006 §3): the same list for the editor component and the headless tests. Attributes the schema does not
// know are removed here (Link keeps only href, OrderedList only start), never filtered after the fact, and content
// rules mirror the schema's, so ProseMirror drops anything else on paste
import { Node } from '@tiptap/core'
import type { Attribute, Extensions } from '@tiptap/core'
import { Blockquote } from '@tiptap/extension-blockquote'
import { Link } from '@tiptap/extension-link'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import { TableCell, TableHeader, TableKit, TableRow } from '@tiptap/extension-table'
import { UniqueID } from '@tiptap/extension-unique-id'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import { StarterKit } from '@tiptap/starter-kit'
import { CURRENT_SCHEMA_VERSION } from '#shared/content/document-schema'
import { contentHref } from '#shared/content/url'
import { BlockMove } from './block-move'
import { CalloutNode } from './callout'
import { CodeBlockNode } from './code-block'
import { EmbedNode, GalleryNode, ImageNode, VideoNode } from './media-nodes'
import { UniqueIdGuard } from './unique-id-guard'

/** Blocks that carry a stable id (document-schema: every block) */
export const BLOCK_TYPES = ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'horizontalRule', 'codeBlock', 'image', 'gallery', 'video', 'embed', 'callout', 'table'] as const

const TEXT_BLOCKS = '(paragraph | bulletList | orderedList)'

const DocumentNode = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+',
  addAttributes() {
    return { schemaVersion: { default: CURRENT_SCHEMA_VERSION, rendered: false } }
  },
})

// Simple tables only: pasted spans and widths are read as the defaults, and no other cell attribute exists
const simpleCellAttributes = () => ({
  colspan: { default: 1, parseHTML: () => 1 },
  rowspan: { default: 1, parseHTML: () => 1 },
  colwidth: { default: null, parseHTML: () => null },
})

const allowedHref = (url: string) => contentHref(url) !== undefined

export interface SchemaExtensionOptions {
  placeholder?: string
  /** Replaces nodes by name, for the editor's node views */
  overrides?: Partial<Record<string, Extensions[number]>>
}

export function schemaExtensions({ placeholder, overrides = {} }: SchemaExtensionOptions = {}): Extensions {
  const nodes: Extensions = [
    DocumentNode,
    Blockquote.extend({ content: `${TEXT_BLOCKS}+` }),
    BulletList,
    OrderedList.extend({
      addAttributes() {
        return { start: (this.parent?.() as Record<string, Attribute>).start! }
      },
    }),
    ListItem.extend({ content: `paragraph ${TEXT_BLOCKS}*` }),
    Link.extend({
      addAttributes() {
        return { href: (this.parent?.() as Record<string, Attribute>).href! }
      },
    }).configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      isAllowedUri: allowedHref,
      shouldAutoLink: allowedHref,
    }),
    CodeBlockNode,
    ImageNode,
    GalleryNode,
    VideoNode,
    EmbedNode,
    CalloutNode,
    TableKit.configure({ table: { resizable: false, allowTableNodeSelection: true }, tableRow: false, tableHeader: false, tableCell: false }),
    TableRow.extend({ content: '(tableHeader | tableCell)+' }),
    TableHeader.extend({ content: 'paragraph+', addAttributes: simpleCellAttributes }),
    TableCell.extend({ content: 'paragraph+', addAttributes: simpleCellAttributes }),
  ]
  return [
    StarterKit.configure({
      document: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      link: false,
      codeBlock: false,
      underline: false,
      // Opening a document must not change it (working_hash); the gap cursor reaches the space after an atom
      trailingNode: false,
      heading: { levels: [2, 3, 4] },
    }),
    ...nodes.map(node => overrides[node.name] ?? node),
    UniqueID.configure({ types: [...BLOCK_TYPES] }),
    UniqueIdGuard.configure({ types: BLOCK_TYPES }),
    BlockMove,
    CharacterCount,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ]
}
