<script setup lang="ts">
// An embed block until the facade of F05-T5: the poster and a link to the video on its provider. Nothing is
// requested from the provider; the link is built from an id the provider's pattern accepts, or not at all
import { EMBED_ID_PATTERNS, EMBED_PROVIDERS } from '#shared/content/document-schema'
import type { EmbedProvider } from '#shared/content/document-schema'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'
import { useContentContext } from '../context'

const props = defineProps<{ node: Record<string, unknown> }>()
const { media } = useContentContext()
const { t } = useI18n()

const WATCH_URL: Record<EmbedProvider, (id: string) => string> = {
  youtube: id => `https://www.youtube.com/watch?v=${id}`,
  vimeo: id => `https://vimeo.com/${id}`,
}
const PROVIDER_NAMES: Record<EmbedProvider, string> = { youtube: 'YouTube', vimeo: 'Vimeo' }

const embed = computed(() => {
  const provider = props.node.provider as EmbedProvider
  const externalId = String(props.node.externalId ?? '')
  if (!EMBED_PROVIDERS.includes(provider) || !EMBED_ID_PATTERNS[provider].test(externalId)) {
    return null
  }
  const poster = media[String(props.node.posterMediaId)]
  return {
    href: WATCH_URL[provider](externalId),
    provider: PROVIDER_NAMES[provider],
    title: typeof props.node.title === 'string' ? props.node.title : '',
    poster: poster?.kind === 'image' ? { ...poster.image, alt: '', decorative: true } : null,
  }
})
</script>

<template>
  <figure
    v-if="embed"
    class="content-figure content-embed"
  >
    <a
      :href="embed.href"
      rel="noopener noreferrer"
    >
      <ResponsiveImage
        v-if="embed.poster"
        :image="embed.poster"
        sizes="(min-width: 48rem) 68ch, calc(100vw - 2rem)"
      />
      <span>{{ t('content.embed.watch', { provider: embed.provider, title: embed.title }) }}</span>
    </a>
  </figure>
</template>
