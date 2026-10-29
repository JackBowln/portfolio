// Moving top-level blocks by keyboard (F05-T3, decision 1): the accessible alternative to dragging, which the
// editor also allows natively (draggable atoms and the drop cursor)
import { Extension } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockMove: {
      moveBlock: (direction: 'up' | 'down') => ReturnType
    }
  }
}

/** Swaps the top-level block around the selection with its neighbor, keeping the selection on the moved block */
export function moveBlock(state: EditorState, direction: 'up' | 'down', dispatch?: (tr: Transaction) => void): boolean {
  const { selection, doc } = state
  const index = selection.$from.index(0)
  const target = direction === 'up' ? index - 1 : index + 1
  const spansBlocks = selection.$to.index(0) !== index && !(selection instanceof NodeSelection)
  if (spansBlocks || target < 0 || target >= doc.childCount) {
    return false
  }
  if (!dispatch) {
    return true
  }
  const lower = Math.min(index, target)
  let start = 0
  for (let child = 0; child < lower; child++) {
    start += doc.child(child).nodeSize
  }
  const first = doc.child(lower)
  const second = doc.child(lower + 1)
  const moved = doc.child(index)
  // Where the moved block starts before and after the swap
  const oldStart = index === lower ? start : start + first.nodeSize
  const newStart = index === lower ? start + second.nodeSize : start
  const tr = state.tr.replaceWith(start, start + first.nodeSize + second.nodeSize, [second, first])
  tr.setSelection(selection instanceof NodeSelection
    ? NodeSelection.create(tr.doc, newStart)
    : TextSelection.near(tr.doc.resolve(Math.min(newStart + (selection.from - oldStart), newStart + moved.nodeSize - 1))))
  dispatch(tr.scrollIntoView())
  return true
}

export const BlockMove = Extension.create({
  name: 'blockMove',
  addCommands() {
    return {
      moveBlock: direction => ({ state, dispatch }) => moveBlock(state, direction, dispatch),
    }
  },
  addKeyboardShortcuts() {
    return {
      'Alt-Shift-ArrowUp': () => this.editor.commands.moveBlock('up'),
      'Alt-Shift-ArrowDown': () => this.editor.commands.moveBlock('down'),
    }
  },
})
