<script setup lang="ts">
// Admin-only (ADR-0006 §3). The document editor: Tiptap with the extensions of schemaExtensions(), so the JSON it
// emits is the document schema; node views for code and media; a toolbar and a contextual toolbar operable by
// keyboard; dialogs for links and media. Saving and revisions belong to the page that uses it (F06-T2)
import { EditorContent, VueNodeViewRenderer, useEditor } from '@tiptap/vue-3'
import type { Editor, JSONContent, Node } from '@tiptap/core'
import type { Component } from 'vue'
import { deriveDocument } from '#shared/content/derive'
import type { DocumentJson } from '#shared/content/document-schema'
import type { Locale } from '#shared/types/enums'
import MediaPicker from '~/components/admin/media/MediaPicker.vue'
import CodeBlockView from './CodeBlockView.vue'
import EditorToolbar from './EditorToolbar.vue'
import EmbedDialog from './EmbedDialog.vue'
import type { EmbedAttrs } from './EmbedDialog.vue'
import GalleryDialog from './GalleryDialog.vue'
import LinkDialog from './LinkDialog.vue'
import MediaNodeView from './MediaNodeView.vue'
import ShortcutsDialog from './ShortcutsDialog.vue'
import { CodeBlockNode } from './extensions/code-block'
import { EmbedNode, GalleryNode, ImageNode, VideoNode } from './extensions/media-nodes'
import { schemaExtensions } from './extensions/schema-extensions'
import { CONTEXT_ACTIONS, TOOLBAR } from './toolbar-actions'
import type { DialogAction, ToolbarGroup } from './toolbar-actions'

const props = withDefaults(defineProps<{ label: string, locale?: Locale }>(), { locale: 'pt-BR' })
const model = defineModel<DocumentJson | undefined>()
const { t } = useI18n()

const toolbar = useTemplateRef<InstanceType<typeof EditorToolbar>>('toolbar')
const linkDialog = useTemplateRef<InstanceType<typeof LinkDialog>>('linkDialog')
const galleryDialog = useTemplateRef<InstanceType<typeof GalleryDialog>>('galleryDialog')
const embedDialog = useTemplateRef<InstanceType<typeof EmbedDialog>>('embedDialog')
const shortcutsDialog = useTemplateRef<InstanceType<typeof ShortcutsDialog>>('shortcutsDialog')
const imagePicker = useTemplateRef<InstanceType<typeof MediaPicker>>('imagePicker')
const videoPicker = useTemplateRef<InstanceType<typeof MediaPicker>>('videoPicker')

const withView = (node: Node, view: Component) => node.extend({ addNodeView: () => VueNodeViewRenderer(view) })

const json = shallowRef<DocumentJson | undefined>(model.value)
const emitJson = (editor: Editor) => {
  json.value = editor.getJSON() as DocumentJson
  model.value = json.value
}

const editor = useEditor({
  extensions: schemaExtensions({
    placeholder: t('admin.editor.placeholder'),
    overrides: {
      codeBlock: withView(CodeBlockNode, CodeBlockView),
      image: withView(ImageNode, MediaNodeView),
      gallery: withView(GalleryNode, MediaNodeView),
      video: withView(VideoNode, MediaNodeView),
      embed: withView(EmbedNode, MediaNodeView),
    },
  }),
  content: (model.value ?? { type: 'doc', content: [{ type: 'paragraph' }] }) as JSONContent,
  injectCSS: false,
  editorProps: {
    attributes: {
      'role': 'textbox',
      'aria-multiline': 'true',
      'aria-label': props.label,
      'class': 'editor-content min-h-64 border border-border p-4 focus-visible:outline-2 focus-visible:outline-focus',
    },
    handleKeyDown: (_view, event) => {
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'k') {
        openDialog('link')
        return true
      }
      if (mod && event.key === '/') {
        openDialog('shortcuts')
        return true
      }
      // The way out of the text, and the usual shortcut to the toolbar
      if (event.key === 'Escape' || (event.altKey && event.key === 'F10')) {
        toolbar.value?.focus()
        return true
      }
      return false
    },
  },
  // UniqueID fills the ids on create, so the first emitted JSON already has them
  onCreate: ({ editor }) => emitJson(editor),
  onUpdate: ({ editor }) => emitJson(editor),
})

const contextGroups = shallowRef<ToolbarGroup[]>([])
function updateContext(instance: Editor) {
  contextGroups.value = CONTEXT_ACTIONS.filter(group => instance.isActive(group.id))
}
watch(editor, (instance) => {
  instance?.on('selectionUpdate', () => updateContext(instance))
  instance?.on('transaction', () => updateContext(instance))
}, { immediate: true })

function openDialog(action: DialogAction) {
  const instance = editor.value
  if (!instance) {
    return
  }
  switch (action) {
    case 'link':
      linkDialog.value?.open(instance.getAttributes('link').href as string | undefined)
      break
    case 'image':
      imagePicker.value?.open()
      break
    case 'video':
      videoPicker.value?.open()
      break
    case 'gallery':
      galleryDialog.value?.open()
      break
    case 'embed':
      embedDialog.value?.open()
      break
    case 'shortcuts':
      shortcutsDialog.value?.open()
      break
  }
}

// An atom is followed by an empty paragraph with the cursor in it, so the next insert never replaces the atom
const insert = (type: string, attrs: Record<string, unknown>) => editor.value?.chain().focus().insertContent([{ type, attrs }, { type: 'paragraph' }]).run()
const setLink = (href: string) => editor.value?.chain().focus().extendMarkRange('link').setLink({ href }).run()
const removeLink = () => editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()

const stats = computed(() => {
  const value = json.value
  return {
    words: value ? deriveDocument(value, props.locale).wordCount : 0,
    characters: editor.value?.storage.characterCount.characters() ?? 0,
  }
})

defineExpose({ editor })
</script>

<template>
  <div class="grid min-w-0 gap-3">
    <template v-if="editor">
      <EditorToolbar
        ref="toolbar"
        :editor="editor"
        :groups="TOOLBAR"
        :label="$t('admin.editor.toolbar')"
        @dialog="openDialog"
      />
      <EditorToolbar
        v-if="contextGroups.length > 0"
        :key="contextGroups.map(group => group.id).join()"
        :editor="editor"
        :groups="contextGroups"
        :label="$t('admin.editor.contextToolbar')"
      />
    </template>
    <EditorContent
      v-if="editor"
      :editor="editor"
      class="min-w-0"
    />
    <p
      class="text-step--1 text-text-muted"
      data-testid="editor-stats"
    >
      {{ $t('admin.editor.stats', { words: stats.words, characters: stats.characters }) }}
    </p>
    <LinkDialog
      ref="linkDialog"
      @apply="setLink"
      @remove="removeLink"
    />
    <GalleryDialog
      ref="galleryDialog"
      @insert="insert('gallery', $event)"
    />
    <EmbedDialog
      ref="embedDialog"
      @insert="(attrs: EmbedAttrs) => insert('embed', { ...attrs })"
    />
    <ShortcutsDialog ref="shortcutsDialog" />
    <MediaPicker
      ref="imagePicker"
      @select="insert('image', { mediaId: $event.id, caption: null, altOverride: null })"
    />
    <MediaPicker
      ref="videoPicker"
      kind="video"
      @select="insert('video', { mediaId: $event.id, caption: null })"
    />
  </div>
</template>

<style>
/* Admin-only, in this component's chunk: ProseMirror's base rules (Tiptap's injected CSS is off, ADR-0012 CSP) and
   the editing area. Shiki's two themes follow the page's color-scheme through light-dark() */
.editor-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-variant-ligatures: none;
  font-feature-settings: "liga" 0;
}

.editor-content [contenteditable="false"] {
  white-space: normal;
}

.editor-content > * + * {
  margin-top: 0.75em;
}

.editor-content h2 { font-size: var(--text-step-2); font-weight: var(--font-weight-strong); }
.editor-content h3 { font-size: var(--text-step-1); font-weight: var(--font-weight-strong); }
.editor-content h4 { font-weight: var(--font-weight-strong); }
.editor-content ul { list-style: disc; padding-left: 1.5em; }
.editor-content ol { list-style: decimal; padding-left: 1.5em; }
.editor-content blockquote { border-left: 3px solid var(--color-border); padding-left: 1em; }
.editor-content aside[data-node="callout"] { border: 1px solid var(--color-border); border-left-width: 4px; padding: 0.75em 1em; }
.editor-content aside[data-tone="tip"] { border-left-color: var(--color-success); }
.editor-content aside[data-tone="warning"],
.editor-content aside[data-tone="danger"] { border-left-color: var(--color-danger); }
.editor-content a { text-decoration: underline; }
.editor-content code { font-family: var(--font-mono); }
.editor-content hr { border-top: 1px solid var(--color-border); }
.editor-content table { border-collapse: collapse; width: 100%; table-layout: fixed; }
.editor-content td,
.editor-content th { border: 1px solid var(--color-border); padding: 0.25em 0.5em; vertical-align: top; }
.editor-content .selectedCell { background: var(--color-surface-active); }
.editor-content .ProseMirror-selectednode { outline: 2px solid var(--color-focus); }
.editor-content .ProseMirror-gapcursor { display: none; pointer-events: none; position: absolute; }
.editor-content .ProseMirror-gapcursor::after { content: ""; display: block; position: absolute; top: -2px; width: 20px; border-top: 1px solid currentColor; animation: editor-cursor-blink 1.1s steps(2, start) infinite; }
.editor-content.ProseMirror-focused .ProseMirror-gapcursor { display: block; }
.editor-content p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--color-text-muted); float: left; height: 0; pointer-events: none; }

@keyframes editor-cursor-blink { to { visibility: hidden; } }

@media (prefers-reduced-motion: reduce) {
  .editor-content .ProseMirror-gapcursor::after { animation: none; }
}

.editor-code-preview pre { padding: 0.75em; background: light-dark(var(--shiki-light-bg), var(--shiki-dark-bg)); }
.editor-code-preview span { color: light-dark(var(--shiki-light), var(--shiki-dark)); font-style: var(--shiki-light-font-style); }
/* light-dark() takes colors only: the dark font style follows the same theme rules as main.css */
:root[data-theme="dark"] .editor-code-preview span { font-style: var(--shiki-dark-font-style); }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .editor-code-preview span { font-style: var(--shiki-dark-font-style); }
}
</style>
