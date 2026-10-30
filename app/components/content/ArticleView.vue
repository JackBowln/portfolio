<script setup lang="ts">
// An article as readers see it: title, lead, reading time, cover (the LCP image) and the body through StaticContent
// (no hydration). Used by the preview (F06-T3) and by the public article page (F06-T5), so both look the same
import type { DocumentJson } from '#shared/content/document-schema'
import type { PublicImage, PublicMediaMap } from '#shared/media/public'
import type { Locale } from '#shared/types/enums'
import StaticContent from '~/components/content/StaticContent.vue'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'

defineProps<{
  locale: Locale
  title: string
  excerpt: string
  body: DocumentJson
  media: PublicMediaMap
  cover: PublicImage | null
  readingTimeMin: number
}>()
</script>

<template>
  <article
    class="grid gap-8"
    :lang="locale"
  >
    <header class="grid gap-4">
      <UiHeading :level="1">
        {{ title }}
      </UiHeading>
      <p
        v-if="excerpt"
        class="text-step-1 text-text-muted"
      >
        {{ excerpt }}
      </p>
      <p
        v-if="readingTimeMin > 0"
        class="text-step--1 text-text-muted"
      >
        {{ $t('content.readingTime', { minutes: readingTimeMin }) }}
      </p>
    </header>
    <ResponsiveImage
      v-if="cover"
      :image="cover"
      sizes="(min-width: 48rem) 68ch, calc(100vw - 2rem)"
      priority
    />
    <StaticContent
      :document="body"
      :media="media"
    />
  </article>
</template>
