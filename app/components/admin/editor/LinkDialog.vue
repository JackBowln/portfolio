<script setup lang="ts">
// Admin-only. Sets or removes the link on the selection; the address is checked with the schema's own rule
import { contentHref } from '#shared/content/url'
import EditorDialog from './EditorDialog.vue'

const emit = defineEmits<{ apply: [href: string], remove: [] }>()

const frame = useTemplateRef<InstanceType<typeof EditorDialog>>('frame')
const href = ref('')
const error = ref<string>()
const hasLink = ref(false)
const { t } = useI18n()

function open(current: string | undefined) {
  href.value = current ?? ''
  hasLink.value = current !== undefined
  error.value = undefined
  frame.value?.open()
}

function apply() {
  const value = href.value.trim()
  if (contentHref(value) === undefined) {
    error.value = t('admin.editor.link.invalid')
    return
  }
  emit('apply', value)
  frame.value?.close()
}

function remove() {
  emit('remove')
  frame.value?.close()
}

defineExpose({ open })
</script>

<template>
  <EditorDialog
    ref="frame"
    :title="$t('admin.editor.link.title')"
  >
    <form
      class="grid gap-4"
      novalidate
      @submit.prevent="apply"
    >
      <UiField
        v-slot="field"
        :label="$t('admin.editor.link.href')"
        :description="$t('admin.editor.link.hint')"
        :error="error"
        required
      >
        <UiInput
          v-model="href"
          v-bind="field"
          type="url"
          autocomplete="off"
          spellcheck="false"
        />
      </UiField>
      <div class="flex flex-wrap gap-3">
        <UiButton type="submit">
          {{ $t('admin.editor.link.apply') }}
        </UiButton>
        <UiButton
          v-if="hasLink"
          variant="secondary"
          @click="remove"
        >
          {{ $t('admin.editor.link.remove') }}
        </UiButton>
        <UiButton
          variant="ghost"
          @click="frame?.close()"
        >
          {{ $t('admin.editor.cancel') }}
        </UiButton>
      </div>
    </form>
  </EditorDialog>
</template>
