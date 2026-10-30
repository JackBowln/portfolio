<script setup lang="ts">
// Admin-only. One image from the library as a form field (an article's cover, its share image): the chosen image,
// a button to pick another (MediaPicker) and one to clear it. The value is the media id
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import type { MediaDetail, MediaListItem } from '~/utils/admin/media'
import { previewImage } from '~/utils/admin/media'
import { adminFetch } from '~/utils/admin/session'
import MediaPicker from './MediaPicker.vue'

const props = defineProps<{ label: string, empty: string, choose: string, change: string, remove: string, error?: string | undefined }>()
const model = defineModel<string | null>({ required: true })

const picker = useTemplateRef<InstanceType<typeof MediaPicker>>('picker')
const detail = ref<MediaDetail | null>(null)
const labelId = useId()
const errorId = useId()

watch(model, async (id) => {
  if (!id) {
    detail.value = null
    return
  }
  if (detail.value?.id === id) {
    return
  }
  detail.value = await adminFetch<MediaDetail>(`/api/admin/media/${encodeURIComponent(id)}`).catch(() => null)
}, { immediate: true })

function select(item: MediaListItem) {
  model.value = item.id
}
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
      {{ props.label }}
    </p>
    <div
      v-if="model && detail"
      class="grid max-w-xs gap-2"
    >
      <ResponsiveImage
        :image="previewImage(detail)"
        sizes="20rem"
      />
      <p class="text-step--1 break-all text-text-muted">
        {{ detail.originalFilename }}
      </p>
    </div>
    <p
      v-else
      class="text-text-muted"
    >
      {{ empty }}
    </p>
    <div class="flex flex-wrap gap-3">
      <UiButton
        variant="secondary"
        size="sm"
        :aria-describedby="error ? errorId : undefined"
        @click="picker?.open()"
      >
        {{ model ? change : choose }}
      </UiButton>
      <UiButton
        v-if="model"
        variant="ghost"
        size="sm"
        @click="model = null"
      >
        {{ remove }}
      </UiButton>
    </div>
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
