<script setup lang="ts">
// Admin-only. The focal point as two native sliders (keyboard and screen readers need nothing custom), with a
// click on the preview as a pointer shortcut and live square and 16:9 crops of the real image
import type { PublicImage } from '#shared/media/public'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'

const props = defineProps<{ image: PublicImage }>()
const model = defineModel<{ x: number, y: number }>({ required: true })

const percent = (value: number) => Math.round(value * 100)
const live = computed<PublicImage>(() => ({ ...props.image, focalX: model.value.x, focalY: model.value.y }))

function setFrom(event: MouseEvent) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const clamp = (value: number) => Math.min(1, Math.max(0, Math.round(value * 100) / 100))
  model.value = { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) }
}

function onRange(axis: 'x' | 'y', event: Event) {
  model.value = { ...model.value, [axis]: Number((event.target as HTMLInputElement).value) / 100 }
}
</script>

<template>
  <div class="grid gap-4">
    <!-- Pointer shortcut only: the sliders below are the accessible way to set the point -->
    <div
      class="relative max-w-md cursor-crosshair"
      aria-hidden="true"
      data-testid="focal-preview"
      @click="setFrom"
    >
      <ResponsiveImage
        :image="{ ...live, decorative: true }"
        sizes="28rem"
      />
      <span
        class="pointer-events-none absolute size-6 -translate-1/2 rounded-full border-2 border-accent-contrast bg-accent shadow-raised"
        :style="{ left: `${percent(model.x)}%`, top: `${percent(model.y)}%` }"
      />
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <label
        v-for="axis in (['x', 'y'] as const)"
        :key="axis"
        class="grid gap-2"
      >
        <span class="font-strong">{{ $t(`admin.media.focal.${axis}`) }}: {{ $t('admin.media.focal.value', { value: percent(model[axis]) }) }}</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          class="min-h-(--target-comfortable) accent-(--color-accent)"
          :value="percent(model[axis])"
          :aria-valuetext="$t('admin.media.focal.value', { value: percent(model[axis]) })"
          @input="onRange(axis, $event)"
        >
      </label>
    </div>
    <div class="flex flex-wrap gap-4">
      <figure
        v-for="crop in [{ key: 'previewSquare', class: 'aspect-square w-32' }, { key: 'previewWide', class: 'aspect-video w-56' }]"
        :key="crop.key"
        class="grid gap-1"
      >
        <div
          class="overflow-hidden bg-surface"
          :class="crop.class"
        >
          <ResponsiveImage
            :image="{ ...live, decorative: true }"
            sizes="14rem"
            fit="cover"
          />
        </div>
        <figcaption class="text-step--1 text-text-muted">
          {{ $t(`admin.media.focal.${crop.key}`) }}
        </figcaption>
      </figure>
    </div>
  </div>
</template>
