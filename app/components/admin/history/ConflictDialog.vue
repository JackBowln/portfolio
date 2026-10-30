<script setup lang="ts">
// Admin-only. Two tabs (or two people) saved the same article or project: autosave stops and nothing is overwritten until the
// owner chooses (F06-T2). The diff shows the saved version against this tab's; "keep mine" saves this tab's on top,
// "use the saved one" drops this tab's changes. Escape keeps the dialog open: the choice is required
import type { TopicItem } from '~/utils/admin/articles'
import { DIFF_FIELDS } from '~/utils/admin/document-diff'
import type { AnyVersionFields, DiffField } from '~/utils/admin/document-diff'
import RevisionDiff from './RevisionDiff.vue'

withDefaults(defineProps<{ theirs: AnyVersionFields | null, mine: AnyVersionFields | null, topics: TopicItem[], fields?: readonly DiffField[] }>(), { fields: () => DIFF_FIELDS })
const emit = defineEmits<{ keepMine: [], useTheirs: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
const textId = useId()

function choose(choice: 'keepMine' | 'useTheirs') {
  dialog.value?.close()
  if (choice === 'keepMine') {
    emit('keepMine')
  }
  else {
    emit('useTheirs')
  }
}

defineExpose({ open: () => dialog.value?.showModal() })
</script>

<template>
  <dialog
    ref="dialog"
    role="alertdialog"
    class="m-auto max-h-[90dvh] w-[min(48rem,100%-2*var(--spacing-gutter))] max-w-none overflow-y-auto border border-border bg-bg p-6 text-text backdrop:bg-text/40"
    :aria-labelledby="titleId"
    :aria-describedby="textId"
    @cancel.prevent
  >
    <div class="grid gap-4">
      <UiHeading
        :id="titleId"
        :level="2"
        :size="3"
      >
        {{ $t('admin.history.conflict.title') }}
      </UiHeading>
      <p :id="textId">
        {{ $t('admin.history.conflict.text') }}
      </p>
      <RevisionDiff
        v-if="theirs && mine"
        :before="theirs"
        :after="mine"
        :before-label="$t('admin.history.conflict.theirs')"
        :after-label="$t('admin.history.conflict.mine')"
        :topics="topics"
        :fields="fields"
      />
      <div class="flex flex-wrap gap-3">
        <UiButton @click="choose('keepMine')">
          {{ $t('admin.history.conflict.keepMine') }}
        </UiButton>
        <UiButton
          variant="secondary"
          @click="choose('useTheirs')"
        >
          {{ $t('admin.history.conflict.useTheirs') }}
        </UiButton>
      </div>
    </div>
  </dialog>
</template>
