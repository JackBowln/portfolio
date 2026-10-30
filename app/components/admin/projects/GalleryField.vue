<script setup lang="ts">
// Admin-only. A project's gallery (F07-T1): ready images from the library in display order, each one moved up or
// down or removed with buttons (keyboard, no drag and drop), and added with the media picker. The value is the list
// of media ids; publishing asks for alt text on every one
import { PROJECT_LIMITS } from '#shared/content/project-input'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import MediaPicker from '~/components/admin/media/MediaPicker.vue'
import type { MediaDetail, MediaListItem } from '~/utils/admin/media'
import { previewImage } from '~/utils/admin/media'
import { adminFetch } from '~/utils/admin/session'

const model = defineModel<string[]>({ required: true })
defineProps<{ error?: string | undefined }>()

const picker = useTemplateRef<InstanceType<typeof MediaPicker>>('picker')
const details = ref<Record<string, MediaDetail | null>>({})
const labelId = useId()
const errorId = useId()

watch(model, async (ids) => {
  for (const id of ids.filter(item => !(item in details.value))) {
    details.value = { ...details.value, [id]: await adminFetch<MediaDetail>(`/api/admin/media/${encodeURIComponent(id)}`).catch(() => null) }
  }
}, { immediate: true })

function select(item: MediaListItem) {
  if (!model.value.includes(item.id)) {
    model.value = [...model.value, item.id]
  }
}

function move(index: number, by: -1 | 1) {
  const next = [...model.value]
  const [item] = next.splice(index, 1)
  next.splice(index + by, 0, item!)
  model.value = next
}

const nameOf = (id: string, index: number) => details.value[id]?.originalFilename ?? `${index + 1}`
</script>

<template>
  <div
    class="grid gap-3"
    role="group"
    :aria-labelledby="labelId"
  >
    <p
      :id="labelId"
      class="font-strong"
    >
      {{ $t('admin.projects.gallery.label') }}
    </p>
    <p
      v-if="model.length === 0"
      class="text-text-muted"
    >
      {{ $t('admin.projects.gallery.empty') }}
    </p>
    <ol
      v-else
      class="grid gap-3"
      data-testid="gallery-list"
    >
      <li
        v-for="(id, index) in model"
        :key="id"
        class="grid gap-2 border-b border-border pb-3 sm:grid-cols-[8rem_1fr] sm:items-center"
      >
        <ResponsiveImage
          v-if="details[id]"
          :image="previewImage(details[id]!)"
          sizes="8rem"
        />
        <div class="grid gap-2">
          <p class="text-step--1 break-all">
            {{ $t('admin.projects.gallery.item', { number: index + 1, name: nameOf(id, index) }) }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UiButton
              variant="secondary"
              size="sm"
              :disabled="index === 0"
              :aria-label="$t('admin.projects.gallery.up', { name: nameOf(id, index) })"
              @click="move(index, -1)"
            >
              {{ $t('admin.projects.order.up') }}
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              :disabled="index === model.length - 1"
              :aria-label="$t('admin.projects.gallery.down', { name: nameOf(id, index) })"
              @click="move(index, 1)"
            >
              {{ $t('admin.projects.order.down') }}
            </UiButton>
            <UiButton
              variant="ghost"
              size="sm"
              :aria-label="$t('admin.projects.gallery.remove', { name: nameOf(id, index) })"
              @click="model = model.filter(item => item !== id)"
            >
              {{ $t('admin.projects.gallery.removeShort') }}
            </UiButton>
          </div>
        </div>
      </li>
    </ol>
    <UiButton
      variant="secondary"
      size="sm"
      class="justify-self-start"
      :disabled="model.length >= PROJECT_LIMITS.gallery"
      :aria-describedby="error ? errorId : undefined"
      @click="picker?.open()"
    >
      {{ $t('admin.projects.gallery.add') }}
    </UiButton>
    <UiFieldError
      :id="errorId"
      :message="error"
    />
    <MediaPicker
      ref="picker"
      @select="select"
    />
  </div>
</template>
