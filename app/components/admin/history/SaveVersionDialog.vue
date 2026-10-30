<script setup lang="ts">
// Admin-only. "Save version": a named point in the history, with an optional note (F06-T2)
import { VERSION_NOTE_MAX } from '#shared/content/article-input'

const emit = defineEmits<{ save: [note: string] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const note = ref('')
const titleId = useId()

function open() {
  note.value = ''
  dialog.value?.showModal()
}

function save() {
  dialog.value?.close()
  emit('save', note.value)
}

defineExpose({ open })
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[min(32rem,100%-2*var(--spacing-gutter))] max-w-none border border-border bg-bg p-6 text-text backdrop:bg-text/40"
    :aria-labelledby="titleId"
  >
    <form
      class="grid gap-4"
      @submit.prevent="save"
    >
      <UiHeading
        :id="titleId"
        :level="2"
        :size="3"
      >
        {{ $t('admin.history.version.title') }}
      </UiHeading>
      <UiField
        v-slot="field"
        :label="$t('admin.history.version.note')"
        :description="$t('admin.history.version.noteHint')"
      >
        <UiInput
          v-model="note"
          v-bind="field"
          :maxlength="VERSION_NOTE_MAX"
          autofocus
        />
      </UiField>
      <div class="flex flex-wrap gap-3">
        <UiButton type="submit">
          {{ $t('admin.history.version.save') }}
        </UiButton>
        <UiButton
          variant="secondary"
          @click="dialog?.close()"
        >
          {{ $t('admin.common.confirmCancel') }}
        </UiButton>
      </div>
    </form>
  </dialog>
</template>
