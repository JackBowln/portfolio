<script setup lang="ts">
// Admin-only. The modal frame of the editor's dialogs, with MediaPicker's focus handling: Esc closes, Tab wraps,
// and the browser returns focus to the opener on close
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()

function wrapFocus(event: KeyboardEvent) {
  const controls = [...(dialog.value?.querySelectorAll<HTMLElement>('input, select, textarea, button:not([disabled])') ?? [])]
  const first = controls[0]
  const last = controls.at(-1)
  if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target?.focus()
  }
}

defineExpose({
  open: () => dialog.value?.showModal(),
  close: () => dialog.value?.close(),
})
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto max-h-[90dvh] w-[min(40rem,100%-2*var(--spacing-gutter))] max-w-none overflow-y-auto border border-border bg-bg p-6 text-text backdrop:bg-text/40"
    :aria-labelledby="titleId"
    @keydown.tab="wrapFocus"
    @close="emit('close')"
  >
    <div class="grid gap-4">
      <UiHeading
        :id="titleId"
        :level="2"
        :size="3"
      >
        {{ title }}
      </UiHeading>
      <slot />
    </div>
  </dialog>
</template>
