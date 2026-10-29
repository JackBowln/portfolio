// Code block of the document schema: an atom with the source in `code` and Shiki's HAST in `hast` (ADR-0006 §3).
// Pasted <pre> becomes a block of plain HAST, highlighted again by the node view once Shiki has loaded
import { Node, mergeAttributes } from '@tiptap/core'
import { plainHast } from '#shared/content/hast'
import type { HastElement } from '#shared/content/hast'
import { languageFromClass } from '~/utils/admin/code-languages'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    codeBlock: {
      insertCodeBlock: (attrs?: { language?: string, code?: string }) => ReturnType
      setCodeBlockSource: (pos: number, attrs: { language: string, code: string, hast: HastElement }) => ReturnType
    }
  }
}

export const CodeBlockNode = Node.create({
  name: 'codeBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      language: { default: 'text', rendered: false },
      code: { default: '', rendered: false },
      hast: { default: plainHast(''), rendered: false },
    }
  },
  parseHTML() {
    return [{
      tag: 'pre',
      preserveWhitespace: 'full',
      getAttrs: (element) => {
        const code = (element.textContent ?? '').replace(/\r\n?/g, '\n').slice(0, 32 * 1024)
        const language = languageFromClass(element.querySelector('code')?.getAttribute('class') ?? element.getAttribute('class'))
        return { language, code, hast: plainHast(code) }
      },
    }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['pre', mergeAttributes(HTMLAttributes), ['code', { class: `language-${node.attrs.language}` }, node.attrs.code]]
  },
  addCommands() {
    return {
      insertCodeBlock: (attrs = {}) => ({ commands }) => {
        const code = attrs.code ?? ''
        // Followed by an empty paragraph, like the media blocks, so typing goes on after the block
        return commands.insertContent([{ type: this.name, attrs: { language: attrs.language ?? 'text', code, hast: plainHast(code) } }, { type: 'paragraph' }])
      },
      // code and hast always change together, so the stored HAST shows exactly the stored code
      setCodeBlockSource: (pos, attrs) => ({ tr, state, dispatch }) => {
        const node = state.doc.nodeAt(pos)
        if (node?.type.name !== this.name) {
          return false
        }
        dispatch?.(tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }))
        return true
      },
    }
  },
})
