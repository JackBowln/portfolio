<script setup lang="ts">
// An image block: the library's alt in the page's locale unless the block overrides it, and the block's caption
// before the library's. A media item that is not ready renders nothing
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import { useContentContext } from '../context'

const props = defineProps<{ node: Record<string, unknown> }>()
const { media } = useContentContext()

const image = computed(() => {
  const item = media[String(props.node.mediaId)]
  if (item?.kind !== 'image') {
    return null
  }
  const override = typeof props.node.altOverride === 'string' && props.node.altOverride.trim() !== '' ? props.node.altOverride : null
  return override ? { ...item.image, alt: override, decorative: false } : item.image
})
const caption = computed(() => (typeof props.node.caption === 'string' && props.node.caption !== '' ? props.node.caption : image.value?.caption ?? null))
</script>

<template>
  <figure
    v-if="image"
    class="content-figure"
  >
    <ResponsiveImage
      :image="image"
      sizes="(min-width: 48rem) 68ch, calc(100vw - 2rem)"
    />
    <figcaption v-if="caption || image.credit">
      {{ caption }}
      <span
        v-if="image.credit"
        class="content-credit"
      >{{ image.credit }}</span>
    </figcaption>
  </figure>
</template>
