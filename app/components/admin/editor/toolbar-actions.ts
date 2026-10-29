// The editor's actions, one list for the toolbar and the shortcuts dialog (F05-T3): what each does, whether it is
// on, and its key binding in Tiptap notation ("Mod" is Cmd on Apple platforms, Ctrl elsewhere)
import type { Editor } from '@tiptap/core'
import type { CalloutTone } from './extensions/callout'

export type DialogAction = 'link' | 'image' | 'gallery' | 'video' | 'embed' | 'shortcuts'

export interface ToolbarAction {
  id: string
  /** Key under admin.editor.actions */
  label: string
  keys?: string
  /** Opens a dialog instead of running a command */
  dialog?: DialogAction
  run?: (editor: Editor) => boolean
  active?: (editor: Editor) => boolean
  /** Whether it can run here; checked with editor.can() */
  enabled?: (editor: Editor) => boolean
}

export interface ToolbarGroup {
  id: string
  actions: ToolbarAction[]
}

const notInTable = (editor: Editor) => !editor.isActive('table')

export const TOOLBAR: ToolbarGroup[] = [
  {
    id: 'text',
    actions: [
      { id: 'paragraph', label: 'paragraph', keys: 'Mod-Alt-0', run: e => e.chain().focus().setParagraph().run(), active: e => e.isActive('paragraph') },
      ...([2, 3, 4] as const).map(level => ({
        id: `heading${level}`,
        label: `heading${level}`,
        keys: `Mod-Alt-${level}`,
        run: (e: Editor) => e.chain().focus().toggleHeading({ level }).run(),
        active: (e: Editor) => e.isActive('heading', { level }),
      })),
    ],
  },
  {
    id: 'marks',
    actions: [
      { id: 'bold', label: 'bold', keys: 'Mod-b', run: e => e.chain().focus().toggleBold().run(), active: e => e.isActive('bold') },
      { id: 'italic', label: 'italic', keys: 'Mod-i', run: e => e.chain().focus().toggleItalic().run(), active: e => e.isActive('italic') },
      { id: 'strike', label: 'strike', keys: 'Mod-Shift-s', run: e => e.chain().focus().toggleStrike().run(), active: e => e.isActive('strike') },
      { id: 'code', label: 'code', keys: 'Mod-e', run: e => e.chain().focus().toggleCode().run(), active: e => e.isActive('code') },
      { id: 'link', label: 'link', keys: 'Mod-k', dialog: 'link', active: e => e.isActive('link') },
    ],
  },
  {
    id: 'blocks',
    actions: [
      { id: 'bulletList', label: 'bulletList', keys: 'Mod-Shift-8', run: e => e.chain().focus().toggleBulletList().run(), active: e => e.isActive('bulletList') },
      { id: 'orderedList', label: 'orderedList', keys: 'Mod-Shift-7', run: e => e.chain().focus().toggleOrderedList().run(), active: e => e.isActive('orderedList') },
      { id: 'blockquote', label: 'blockquote', keys: 'Mod-Shift-b', run: e => e.chain().focus().toggleBlockquote().run(), active: e => e.isActive('blockquote') },
      { id: 'callout', label: 'callout', run: e => e.chain().focus().toggleCallout('info').run(), active: e => e.isActive('callout') },
      { id: 'horizontalRule', label: 'horizontalRule', run: e => e.chain().focus().setHorizontalRule().run(), enabled: notInTable },
    ],
  },
  {
    id: 'insert',
    actions: [
      { id: 'codeBlock', label: 'codeBlock', run: e => e.chain().focus().insertCodeBlock().run(), enabled: notInTable },
      { id: 'image', label: 'image', dialog: 'image', enabled: notInTable },
      { id: 'gallery', label: 'gallery', dialog: 'gallery', enabled: notInTable },
      { id: 'video', label: 'video', dialog: 'video', enabled: notInTable },
      { id: 'embed', label: 'embed', dialog: 'embed', enabled: notInTable },
      { id: 'table', label: 'table', run: e => e.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(), enabled: notInTable },
    ],
  },
  {
    id: 'arrange',
    actions: [
      { id: 'moveUp', label: 'moveUp', keys: 'Alt-Shift-ArrowUp', run: e => e.chain().focus().moveBlock('up').run(), enabled: e => e.can().moveBlock('up') },
      { id: 'moveDown', label: 'moveDown', keys: 'Alt-Shift-ArrowDown', run: e => e.chain().focus().moveBlock('down').run(), enabled: e => e.can().moveBlock('down') },
      { id: 'undo', label: 'undo', keys: 'Mod-z', run: e => e.chain().focus().undo().run(), enabled: e => e.can().undo() },
      { id: 'redo', label: 'redo', keys: 'Mod-Shift-z', run: e => e.chain().focus().redo().run(), enabled: e => e.can().redo() },
      { id: 'shortcuts', label: 'shortcuts', keys: 'Mod-/', dialog: 'shortcuts' },
    ],
  },
]

/** Controls for the block around the cursor, shown only when they apply */
export const CONTEXT_ACTIONS: ToolbarGroup[] = [
  {
    id: 'callout',
    actions: (['info', 'tip', 'warning', 'danger'] as CalloutTone[]).map(tone => ({
      id: `tone-${tone}`,
      label: `tone.${tone}`,
      run: (e: Editor) => e.chain().focus().setCalloutTone(tone).run(),
      active: (e: Editor) => e.isActive('callout', { tone }),
    })),
  },
  {
    id: 'table',
    actions: [
      { id: 'addRow', label: 'addRow', run: e => e.chain().focus().addRowAfter().run() },
      { id: 'deleteRow', label: 'deleteRow', run: e => e.chain().focus().deleteRow().run(), enabled: e => e.can().deleteRow() },
      { id: 'addColumn', label: 'addColumn', run: e => e.chain().focus().addColumnAfter().run() },
      { id: 'deleteColumn', label: 'deleteColumn', run: e => e.chain().focus().deleteColumn().run(), enabled: e => e.can().deleteColumn() },
      { id: 'deleteTable', label: 'deleteTable', run: e => e.chain().focus().deleteTable().run() },
    ],
  },
]

/** Bindings that are not toolbar buttons, for the shortcuts dialog */
export const OTHER_SHORTCUTS: { label: string, keys: string }[] = [
  { label: 'hardBreak', keys: 'Shift-Enter' },
  { label: 'indent', keys: 'Tab' },
  { label: 'outdent', keys: 'Shift-Tab' },
  { label: 'focusToolbar', keys: 'Alt-F10' },
  { label: 'leaveText', keys: 'Escape' },
]

export const isApple = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** "Mod-Shift-z" as aria-keyshortcuts wants it: "Meta+Shift+Z" or "Control+Shift+Z" */
export function ariaKeys(keys: string, apple = isApple()): string {
  return keys.split('-').map(key => (key === 'Mod' ? (apple ? 'Meta' : 'Control') : key.length === 1 ? key.toUpperCase() : key)).join('+')
}

/** For people: "Ctrl+Shift+Z" or "⌘⇧Z" */
export function displayKeys(keys: string, apple = isApple()): string {
  const names: Record<string, string> = apple
    ? { Mod: '⌘', Alt: '⌥', Shift: '⇧', ArrowUp: '↑', ArrowDown: '↓', Enter: '↩', Escape: 'Esc' }
    : { Mod: 'Ctrl', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc' }
  return keys.split('-').map(key => names[key] ?? (key.length === 1 ? key.toUpperCase() : key)).join(apple ? '' : '+')
}
