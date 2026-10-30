<script setup lang="ts">
// Admin-only. Confirmation before something that cannot be undone from the admin: a modal <dialog> (alertdialog),
// Cancel first so Enter does not confirm by accident
defineProps<{ title: string, text: string, confirmLabel: string }>()
const emit = defineEmits<{ confirm: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
const textId = useId()

function confirm() {
  dialog.value?.close()
  emit('confirm')
}

defineExpose({ open: () => dialog.value?.showModal() })
</script>

<template>
  <dialog
    ref="dialog"
    role="alertdialog"
    class="m-auto w-[min(32rem,100%-2*var(--spacing-gutter))] max-w-none border border-border bg-bg p-6 text-text backdrop:bg-text/40"
    :aria-labelledby="titleId"
    :aria-describedby="textId"
  >
    <div class="grid gap-4">
      <UiHeading
        :id="titleId"
        :level="2"
        :size="3"
      >
        {{ title }}
      </UiHeading>
      <p :id="textId">
        {{ text }}
      </p>
      <div class="flex flex-wrap gap-3">
        <UiButton
          variant="secondary"
          autofocus
          @click="dialog?.close()"
        >
          {{ $t('admin.common.confirmCancel') }}
        </UiButton>
        <UiButton @click="confirm">
          {{ confirmLabel }}
        </UiButton>
      </div>
    </div>
  </dialog>
</template>
