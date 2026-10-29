<script setup lang="ts">
// Admin-only. WAI-ARIA toolbar: one tab stop, arrows (and Home/End) move between buttons. A button that cannot run
// here stays focusable with aria-disabled, so the arrow order never changes under the pointer or the keyboard
import type { Editor } from '@tiptap/core'
import type { DialogAction, ToolbarAction, ToolbarGroup } from './toolbar-actions'
import { ariaKeys, displayKeys } from './toolbar-actions'

const props = defineProps<{ editor: Editor, groups: ToolbarGroup[], label: string }>()
const emit = defineEmits<{ dialog: [action: DialogAction] }>()

const { t } = useI18n()
const root = useTemplateRef<HTMLElement>('root')
const current = ref(0)

// Tiptap state is outside Vue's reactivity; every transaction bumps this, and the states below read it
const version = ref(0)
const bump = () => version.value++
props.editor.on('transaction', bump)
onBeforeUnmount(() => props.editor.off('transaction', bump))

const actions = computed(() => props.groups.flatMap(group => group.actions))
// Each button's position in the whole toolbar, for the roving tab stop
const indexed = computed(() => {
  let index = 0
  return props.groups.map(group => ({ id: group.id, actions: group.actions.map(action => ({ action, index: index++ })) }))
})
const states = computed(() => {
  void version.value
  return actions.value.map(action => ({
    active: action.active?.(props.editor) ?? false,
    enabled: action.enabled?.(props.editor) ?? true,
  }))
})

function name(action: ToolbarAction) {
  const label = t(`admin.editor.actions.${action.label}`)
  return action.keys ? `${label} (${displayKeys(action.keys)})` : label
}

function activate(action: ToolbarAction, index: number) {
  current.value = index
  if (!states.value[index]?.enabled) {
    return
  }
  if (action.dialog) {
    emit('dialog', action.dialog)
  }
  else {
    action.run?.(props.editor)
  }
}

function buttons() {
  return [...(root.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
}

function move(event: KeyboardEvent) {
  const count = actions.value.length
  const next = { ArrowRight: current.value + 1, ArrowLeft: current.value - 1, Home: 0, End: count - 1 }[event.key]
  if (next === undefined) {
    return
  }
  event.preventDefault()
  current.value = (next + count) % count
  buttons()[current.value]?.focus()
}

defineExpose({ focus: () => buttons()[current.value]?.focus() })
</script>

<template>
  <div
    ref="root"
    role="toolbar"
    :aria-label="label"
    class="flex flex-wrap gap-x-3 gap-y-2"
    @keydown="move"
  >
    <div
      v-for="group in indexed"
      :key="group.id"
      class="flex flex-wrap gap-1"
    >
      <button
        v-for="{ action, index } in group.actions"
        :key="action.id"
        type="button"
        :tabindex="index === current ? 0 : -1"
        :aria-pressed="action.active ? (states[index]?.active ?? false) : undefined"
        :aria-disabled="states[index]?.enabled ? undefined : 'true'"
        :aria-haspopup="action.dialog ? 'dialog' : undefined"
        :aria-keyshortcuts="action.keys ? ariaKeys(action.keys) : undefined"
        :title="name(action)"
        :data-action="action.id"
        class="min-h-(--target-min) cursor-pointer rounded-control border border-border px-2 text-step--1 hover:border-text aria-disabled:cursor-not-allowed aria-disabled:opacity-(--opacity-disabled) aria-pressed:border-accent aria-pressed:bg-surface-active"
        @mousedown.prevent
        @click="activate(action, index)"
      >
        {{ $t(`admin.editor.actions.${action.label}`) }}
      </button>
    </div>
  </div>
</template>
