<script setup lang="ts">
// A video block: MediaVideo (native controls, nothing downloaded before play) and the block's caption
import MediaVideo from '~/components/media/MediaVideo.vue'
import { useContentContext } from '../context'

const props = defineProps<{ node: Record<string, unknown> }>()
const { media } = useContentContext()

const video = computed(() => {
  const item = media[String(props.node.mediaId)]
  return item?.kind === 'video' ? item.video : null
})
const caption = computed(() => (typeof props.node.caption === 'string' && props.node.caption !== '' ? props.node.caption : null))
</script>

<template>
  <figure
    v-if="video"
    class="content-figure"
  >
    <MediaVideo :video="video" />
    <figcaption v-if="caption">
      {{ caption }}
    </figcaption>
  </figure>
</template>
