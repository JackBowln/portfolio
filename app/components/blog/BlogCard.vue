<script setup lang="ts">
// One article in a list: title as the link, lead, date and reading time, and the cover. The heading level follows
// the page outline (h2 in the blog index, h3 under "related"); `wide` for a list in the default container, whose
// covers are wider than the reading measure; `priority` for the first card of a list, whose cover is the LCP
import type { BlogCard } from '#shared/content/blog'
import { IMAGE_SIZES } from '#shared/design/tokens'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'

withDefaults(defineProps<{ card: BlogCard, level?: 2 | 3, wide?: boolean, priority?: boolean }>(), { level: 2, wide: false, priority: false })
const formatDate = useFormatDate()
</script>

<template>
  <article class="grid gap-3 border-t border-border pt-6">
    <ResponsiveImage
      v-if="card.cover"
      :image="card.cover"
      :sizes="wide ? IMAGE_SIZES.wide : IMAGE_SIZES.reading"
      :priority="priority"
    />
    <UiHeading
      :level="level"
      :size="level === 2 ? 3 : 2"
    >
      <NuxtLinkLocale
        :to="{ name: 'blog-slug', params: { slug: card.slug } }"
        class="underline-offset-(--underline-offset) hover:text-accent hover:underline"
      >
        {{ card.title }}
      </NuxtLinkLocale>
    </UiHeading>
    <p
      v-if="card.excerpt"
      class="text-text-muted"
    >
      {{ card.excerpt }}
    </p>
    <p class="text-step--1 text-text-muted">
      <time :datetime="card.firstPublishedAt">{{ formatDate(card.firstPublishedAt) }}</time>
      <template v-if="card.readingTimeMin">
        · {{ $t('blog.readingTime', { minutes: card.readingTimeMin }) }}
      </template>
    </p>
  </article>
</template>
