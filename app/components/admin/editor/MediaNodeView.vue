<script setup lang="ts">
// Admin-only. Node view of the media blocks (image, gallery, video, embed): a preview of what the block points at,
// and the fields the node itself holds (caption, alt override, gallery layout). Alt text, poster and captions of
// the media live in the library (ADR-0007), so they are edited there
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { nodeViewId } from './node-view-id'
import { GALLERY_LAYOUTS } from '#shared/content/document-schema'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import type { MediaDetail } from '~/utils/admin/media'
import { previewImage } from '~/utils/admin/media'
import { adminFetch } from '~/utils/admin/session'

const props = defineProps(nodeViewProps)
const type = computed(() => props.node.type.name as 'image' | 'gallery' | 'video' | 'embed')
const attrs = computed(() => props.node.attrs)
const captionId = nodeViewId('captionId')
const altId = nodeViewId('altId')
const layoutId = nodeViewId('layoutId')

const ids = computed<string[]>(() => {
  switch (type.value) {
    case 'gallery':
      return attrs.value.items
    case 'embed':
      return [attrs.value.posterMediaId]
    default:
      return [attrs.value.mediaId]
  }
})

// Previews only; a missing item shows its id, and the schema still holds
const details = ref<Record<string, MediaDetail | null>>({})
watch(ids, async (list) => {
  for (const id of list.filter(item => !(item in details.value))) {
    details.value = { ...details.value, [id]: null }
    adminFetch<MediaDetail>(`/api/admin/media/${id}`).then((detail) => {
      details.value = { ...details.value, [id]: detail }
    }, () => {})
  }
}, { immediate: true })

const previewOf = (id: string) => {
  const detail = details.value[id]
  return detail?.kind === 'image' && detail.variants.length > 0 ? previewImage(detail) : null
}
const nameOf = (id: string) => details.value[id]?.originalFilename ?? id

const text = (value: string) => (value.trim() === '' ? null : value)
</script>

<template>
  <NodeViewWrapper
    as="div"
    class="my-4 grid gap-3 border border-border p-3"
    :class="{ 'outline-2 outline-focus': selected }"
    :data-node-view="type"
    contenteditable="false"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="font-strong">
        {{ $t(`admin.editor.blocks.${type}`) }}
        <span
          v-if="type === 'embed'"
          class="font-normal"
        >· {{ $t(`admin.editor.embed.providers.${attrs.provider}`) }} · {{ attrs.title }}</span>
      </p>
      <UiButton
        variant="ghost"
        size="sm"
        @click="deleteNode()"
      >
        {{ $t('admin.editor.removeBlock') }}
      </UiButton>
    </div>
    <ul
      class="grid gap-2"
      :class="type === 'gallery' ? 'grid-cols-3 sm:grid-cols-4' : 'max-w-xs'"
    >
      <li
        v-for="id in ids"
        :key="id"
        class="grid gap-1"
      >
        <span class="block aspect-video overflow-hidden bg-surface">
          <ResponsiveImage
            v-if="previewOf(id)"
            :image="previewOf(id)!"
            sizes="12rem"
            fit="cover"
          />
        </span>
        <span class="text-step--1 break-all">{{ nameOf(id) }}</span>
      </li>
    </ul>
    <div
      v-if="type === 'image' || type === 'video'"
      class="grid gap-1"
    >
      <label
        :for="captionId"
        class="text-step--1 font-strong"
      >{{ $t('admin.editor.media.caption') }}</label>
      <input
        :id="captionId"
        :value="attrs.caption ?? ''"
        maxlength="500"
        class="min-h-(--target-min) w-full border border-border bg-bg px-2"
        @input="updateAttributes({ caption: text(($event.target as HTMLInputElement).value) })"
      >
    </div>
    <div
      v-if="type === 'image'"
      class="grid gap-1"
    >
      <label
        :for="altId"
        class="text-step--1 font-strong"
      >{{ $t('admin.editor.media.altOverride') }}</label>
      <p
        :id="`${altId}-hint`"
        class="text-step--1 text-text-muted"
      >
        {{ $t('admin.editor.media.altOverrideHint') }}
      </p>
      <input
        :id="altId"
        :value="attrs.altOverride ?? ''"
        maxlength="500"
        :aria-describedby="`${altId}-hint`"
        class="min-h-(--target-min) w-full border border-border bg-bg px-2"
        @input="updateAttributes({ altOverride: text(($event.target as HTMLInputElement).value) })"
      >
    </div>
    <div
      v-if="type === 'gallery'"
      class="grid gap-1"
    >
      <label
        :for="layoutId"
        class="text-step--1 font-strong"
      >{{ $t('admin.editor.gallery.layout') }}</label>
      <select
        :id="layoutId"
        :value="attrs.layout"
        class="min-h-(--target-min) border border-border bg-bg px-2"
        @change="updateAttributes({ layout: ($event.target as HTMLSelectElement).value })"
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
  </NodeViewWrapper>
</template>
