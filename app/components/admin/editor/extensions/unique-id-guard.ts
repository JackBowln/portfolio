// Block ids must be unique in the document (document-schema). UniqueID fills missing ids, but a split that copies
// a node (a table inserted inside a table splits the outer one) keeps the same id on both halves. After every
// change, later repeats of an id get a new one; the first occurrence keeps it, so anchors stay stable
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const UniqueIdGuard = Extension.create<{ types: readonly string[] }>({
  name: 'uniqueIdGuard',
  addOptions() {
    return { types: [] }
  },
  addProseMirrorPlugins() {
    const types = new Set(this.options.types)
    return [new Plugin({
      key: new PluginKey('uniqueIdGuard'),
      appendTransaction: (transactions, _oldState, state) => {
        if (!transactions.some(transaction => transaction.docChanged)) {
          return null
        }
        const seen = new Set<string>()
        const repeats: number[] = []
        state.doc.descendants((node, pos) => {
          const id = node.attrs.id as unknown
          if (types.has(node.type.name) && typeof id === 'string') {
            if (seen.has(id)) {
              repeats.push(pos)
            }
            seen.add(id)
          }
        })
        if (repeats.length === 0) {
          return null
        }
        const tr = state.tr
        for (const pos of repeats) {
          tr.setNodeAttribute(pos, 'id', crypto.randomUUID())
        }
        return tr.setMeta('addToHistory', false)
      },
    })]
  },
})
