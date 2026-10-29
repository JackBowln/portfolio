<script setup lang="ts">
// Test-only fixture: exists only in the Playwright build (`ignore: **/_test/**`). Renders uploaded media the way
// public pages will: `?lcp=` as the priority image, `?images=` (comma-separated ids) lazy below the fold and
// `?video=`, so the delivery, the markup and Lighthouse can be checked with real files
import type { PublicImage, PublicVideo } from '#shared/media/public'
import MediaVideo from '~/components/media/MediaVideo.vue'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'

type TestMedia = { kind: 'image', image: PublicImage } | { kind: 'video', video: PublicVideo }

const route = useRoute()
const { locale } = useI18n()
const ids = (value: unknown) => String(value ?? '').split(',').filter(id => /^[0-9a-f-]{36}$/.test(id))

// useRequestFetch keeps the request's context during SSR; a bare $fetch to /api runs without the Cloudflare bindings
const requestFetch = useRequestFetch()
const { data } = await useAsyncData('test-media', async () => {
  const load = (id: string) => requestFetch<TestMedia>(`/api/_test/media/${id}`, { query: { locale: locale.value } })
  const [lcp] = await Promise.all(ids(route.query.lcp).map(load))
  const images = await Promise.all(ids(route.query.images).map(load))
  const [video] = await Promise.all(ids(route.query.video).map(load))
  return { lcp, images: images.flatMap(item => item.kind === 'image' ? [item.image] : []), video }
})

useHead({ title: 'TEST media', meta: [{ name: 'description', content: 'TEST media delivery page' }, { name: 'robots', content: 'noindex' }] })
</script>

<template>
  <div class="grid gap-section">
    <h1>TEST media</h1>
    <ResponsiveImage
      v-if="data?.lcp?.kind === 'image'"
      :image="data.lcp.image"
      sizes="(min-width: 1440px) 1360px, 100vw"
      priority
      data-testid="lcp-image"
    />
    <!-- Keeps the lazy images below the fold on every viewport, so the priority image is the LCP -->
    <div
      class="h-[150vh]"
      aria-hidden="true"
    />
    <ResponsiveImage
      v-for="(image, index) in data?.images ?? []"
      :key="index"
      :image="image"
      sizes="(min-width: 768px) 50vw, 100vw"
      data-testid="lazy-image"
    />
    <MediaVideo
      v-if="data?.video?.kind === 'video'"
      :video="data.video.video"
      data-testid="video"
    />
  </div>
</template>
