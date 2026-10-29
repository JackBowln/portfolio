<script setup lang="ts">
// Every public video (ADR-0007 §4): native controls, never autoplay, nothing downloaded until play (preload none),
// the poster as the first frame, and one selectable track per locale, the current locale's on by default
import type { PublicVideo } from '#shared/media/public'

const props = defineProps<{ video: PublicVideo }>()

const { locale } = useI18n()
const mediaUrl = useMediaUrl()

const src = computed(() => mediaUrl(props.video.key))
const poster = computed(() => {
  const jpegs = props.video.poster?.variants.filter(variant => variant.format === 'jpeg').toSorted((a, b) => a.width - b.width) ?? []
  const chosen = jpegs.filter(variant => variant.width <= 1280).at(-1) ?? jpegs[0]
  return chosen ? mediaUrl(chosen.key) : undefined
})
const tracks = computed(() => props.video.tracks.flatMap((track) => {
  const url = mediaUrl(track.key)
  return url ? [{ ...track, url }] : []
}))
// One default: captions in the current locale first, then subtitles
const defaultTrack = computed(() => tracks.value.find(track => track.locale === locale.value && track.kind === 'captions')
  ?? tracks.value.find(track => track.locale === locale.value))
</script>

<template>
  <video
    controls
    preload="none"
    playsinline
    :width="video.width"
    :height="video.height"
    :poster="poster"
    class="block h-auto max-w-full"
  >
    <source
      :src="src"
      :type="video.mimeType"
    >
    <track
      v-for="track in tracks"
      :key="track.key"
      :kind="track.kind"
      :srclang="track.locale"
      :label="track.label"
      :src="track.url"
      :default="track === defaultTrack"
    >
    <p>
      {{ $t('media.videoFallback') }}
      <a :href="src">{{ $t('media.videoDownload') }}</a>
    </p>
  </video>
</template>
