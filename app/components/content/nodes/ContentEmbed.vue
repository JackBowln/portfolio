<script setup lang="ts">
// An embed block as a facade (F05-T5): the poster in a 16:9 box and a play button; nothing is requested from the
// provider until the reader clicks, and then the enhancement script swaps in the privacy-preserving player
// (utils/content/enhance.ts). Without JS the button stays hidden and the caption links to the video on its site.
// URLs are built from an id the provider's pattern accepts, or the block renders nothing
import { EMBED_PROVIDER_NAMES, embedPlayerUrl, embedWatchUrl, isEmbedId } from '#shared/content/embeds'
import { IMAGE_SIZES } from '#shared/design/tokens'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import { useContentContext } from '../context'

const props = defineProps<{ node: Record<string, unknown> }>()
const { media } = useContentContext()
const { t } = useI18n()

const embed = computed(() => {
  const provider = String(props.node.provider ?? '')
  const externalId = String(props.node.externalId ?? '')
  if (!isEmbedId(provider, externalId)) {
    return null
  }
  const poster = media[String(props.node.posterMediaId)]
  return {
    player: embedPlayerUrl(provider, externalId)!,
    watch: embedWatchUrl(provider, externalId)!,
    provider: EMBED_PROVIDER_NAMES[provider],
    title: typeof props.node.title === 'string' ? props.node.title : '',
    // The play button names the video, so the poster is decorative
    poster: poster?.kind === 'image' ? { ...poster.image, alt: '', decorative: true } : null,
  }
})
</script>

<template>
  <figure
    v-if="embed"
    class="content-figure content-embed"
  >
    <div
      class="content-embed-frame"
      data-content-embed
      :data-player="embed.player"
      :data-title="embed.title"
    >
      <ResponsiveImage
        v-if="embed.poster"
        :image="embed.poster"
        :sizes="IMAGE_SIZES.reading"
        fit="cover"
      />
      <button
        type="button"
        class="content-embed-play"
        data-content-play
      >
        <span
          class="content-embed-icon"
          aria-hidden="true"
        />
        <span class="sr-only">{{ t('content.embed.play', { title: embed.title }) }}</span>
      </button>
    </div>
    <figcaption>
      <a
        :href="embed.watch"
        rel="noopener noreferrer"
      >{{ t('content.embed.watch', { provider: embed.provider, title: embed.title }) }}</a>
    </figcaption>
  </figure>
</template>
