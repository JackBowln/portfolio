// Callout of the document schema: a tone and the same content a blockquote takes
import { Node, mergeAttributes } from '@tiptap/core'
import { CALLOUT_TONES } from '#shared/content/document-schema'

export type CalloutTone = (typeof CALLOUT_TONES)[number]

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      toggleCallout: (tone?: CalloutTone) => ReturnType
      setCalloutTone: (tone: CalloutTone) => ReturnType
    }
  }
}

export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: '(paragraph | bulletList | orderedList)+',
  defining: true,
  addAttributes() {
    return {
      tone: {
        default: 'info',
        parseHTML: (element) => {
          const tone = element.getAttribute('data-tone')
          return (CALLOUT_TONES as readonly (string | null)[]).includes(tone) ? tone : 'info'
        },
        renderHTML: attributes => ({ 'data-tone': attributes.tone }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'aside[data-node="callout"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-node': 'callout' }), 0]
  },
  addCommands() {
    return {
      toggleCallout: (tone = 'info') => ({ commands }) => commands.toggleWrap(this.name, { tone }),
      setCalloutTone: tone => ({ commands }) => commands.updateAttributes(this.name, { tone }),
    }
  },
})
