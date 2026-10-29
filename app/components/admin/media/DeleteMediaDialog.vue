<script setup lang="ts">
// Admin-only. Confirmation before a soft delete: a modal <dialog>, Cancel first so Enter does not delete by accident
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
        {{ $t('admin.media.delete.confirmTitle') }}
      </UiHeading>
      <p :id="textId">
        {{ $t('admin.media.delete.confirmText') }}
      </p>
      <div class="flex flex-wrap gap-3">
        <UiButton
          variant="secondary"
          autofocus
          @click="dialog?.close()"
        >
          {{ $t('admin.media.delete.cancel') }}
        </UiButton>
        <UiButton @click="confirm">
          {{ $t('admin.media.delete.confirm') }}
        </UiButton>
      </div>
    </div>
  </dialog>
</template>
