<script setup lang="ts">
// Admin-only. Builds a gallery one image at a time from the library (F05-T3, decision 3); it is inserted only with
// the 2 to 24 images the schema asks for
import { GALLERY_LAYOUTS } from '#shared/content/document-schema'
import MediaPicker from '~/components/admin/media/MediaPicker.vue'
import type { MediaListItem } from '~/utils/admin/media'
import EditorDialog from './EditorDialog.vue'

type Layout = (typeof GALLERY_LAYOUTS)[number]
const MAX_ITEMS = 24

const emit = defineEmits<{ insert: [attrs: { items: string[], layout: Layout }] }>()

const frame = useTemplateRef<InstanceType<typeof EditorDialog>>('frame')
const picker = useTemplateRef<InstanceType<typeof MediaPicker>>('picker')
const items = ref<MediaListItem[]>([])
const layout = ref<Layout>('grid')
const layoutId = useId()

function open() {
  items.value = []
  layout.value = 'grid'
  frame.value?.open()
}

function add(item: MediaListItem) {
  if (!items.value.some(existing => existing.id === item.id) && items.value.length < MAX_ITEMS) {
    items.value = [...items.value, item]
  }
}

function insert() {
  if (items.value.length >= 2) {
    emit('insert', { items: items.value.map(item => item.id), layout: layout.value })
    frame.value?.close()
  }
}

defineExpose({ open })
</script>

<template>
  <EditorDialog
    ref="frame"
    :title="$t('admin.editor.gallery.title')"
  >
    <form
      class="grid gap-4"
      @submit.prevent="insert"
    >
      <p class="text-step--1 text-text-muted">
        {{ $t('admin.editor.gallery.hint', { min: 2, max: MAX_ITEMS }) }}
      </p>
      <ol
        v-if="items.length > 0"
        class="grid gap-2"
        :aria-label="$t('admin.editor.gallery.chosen')"
      >
        <li
          v-for="(item, index) in items"
          :key="item.id"
          class="flex items-center justify-between gap-3 border border-border p-2"
          data-testid="gallery-item"
        >
          <span class="break-all">{{ item.originalFilename }}</span>
          <UiButton
            variant="ghost"
            size="sm"
            :aria-label="$t('admin.editor.gallery.removeItem', { name: item.originalFilename, position: index + 1 })"
            @click="items = items.filter(other => other.id !== item.id)"
          >
            {{ $t('admin.editor.gallery.remove') }}
          </UiButton>
        </li>
      </ol>
      <p
        aria-live="polite"
        class="text-step--1"
      >
        {{ $t('admin.editor.gallery.count', { count: items.length }) }}
      </p>
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="items.length >= MAX_ITEMS"
        @click="picker?.open()"
      >
        {{ $t('admin.editor.gallery.add') }}
      </UiButton>
      <div class="grid gap-2">
        <label
          :for="layoutId"
          class="font-strong"
        >{{ $t('admin.editor.gallery.layout') }}</label>
        <select
          :id="layoutId"
          v-model="layout"
          class="min-h-(--target-comfortable) border border-border bg-bg px-3"
        >
          <option
            v-for="item in GALLERY_LAYOUTS"
            :key="item"
            :value="item"
          >
            {{ $t(`admin.editor.gallery.layouts.${item}`) }}
          </option>
        </select>
      </div>
      <div class="flex flex-wrap gap-3">
        <UiButton
          type="submit"
          :disabled="items.length < 2"
        >
          {{ $t('admin.editor.gallery.insert') }}
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
  <MediaPicker
    ref="picker"
    @select="add"
  />
</template>
