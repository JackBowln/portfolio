<script setup lang="ts">
// A gallery block: thumbnails in a grid or a stack, each a button that opens its image in a modal <dialog>.
// The `command` attributes open and close the dialogs with no JS (invoker commands); the enhancement script covers
// browsers without them. Each enlarged image is lazy inside its closed dialog, so it loads only when opened
import { IMAGE_SIZES } from '#shared/design/tokens'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import type { PublicImage } from '#shared/media/public'
import { useContentContext } from '../context'

const props = defineProps<{ node: Record<string, unknown> }>()
const { media } = useContentContext()
const { t } = useI18n()
const id = useId()

const images = computed(() => (Array.isArray(props.node.items) ? props.node.items : []).flatMap((mediaId) => {
  const item = media[String(mediaId)]
  return item?.kind === 'image' ? [item.image] : []
}) as PublicImage[])
const layout = computed(() => (props.node.layout === 'stack' ? 'stack' : 'grid'))
</script>

<template>
  <figure
    v-if="images.length > 0"
    class="content-gallery"
    :data-layout="layout"
  >
    <ul>
      <li
        v-for="(image, index) in images"
        :key="index"
      >
        <button
          type="button"
          class="content-gallery-open"
          aria-haspopup="dialog"
          :commandfor="`${id}-${index}`"
          command="show-modal"
        >
          <ResponsiveImage
            :image="image"
            :sizes="layout === 'grid' ? IMAGE_SIZES.readingThird : IMAGE_SIZES.reading"
            :fit="layout === 'grid' ? 'cover' : undefined"
          />
          <span class="sr-only">{{ t('content.gallery.open', { n: index + 1, total: images.length }) }}</span>
        </button>
        <dialog
          :id="`${id}-${index}`"
          class="content-gallery-dialog"
          :aria-label="t('content.gallery.dialog', { n: index + 1, total: images.length })"
        >
          <button
            type="button"
            class="content-gallery-close"
            :commandfor="`${id}-${index}`"
            command="close"
          >
            {{ t('content.gallery.close') }}
          </button>
          <figure>
            <ResponsiveImage
              :image="image"
              sizes="100vw"
            />
            <figcaption v-if="image.caption">
              {{ image.caption }}
            </figcaption>
          </figure>
        </dialog>
      </li>
    </ul>
  </figure>
</template>
