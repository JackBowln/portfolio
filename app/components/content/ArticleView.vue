<script setup lang="ts">
// An article as readers see it: title, lead, dates, reading time, topics, cover (the LCP image), an optional table
// of contents (slot `toc`) and the body through StaticContent (no hydration), then the slot `after` (related
// articles). Used by the preview (F06-T3) and the public article page (F06-T5), so both look the same
import type { BlogTopic } from '#shared/content/blog'
import type { DocumentJson } from '#shared/content/document-schema'
import type { PublicImage, PublicMediaMap } from '#shared/media/public'
import type { Locale } from '#shared/types/enums'
import TopicLinks from '~/components/blog/TopicLinks.vue'
import StaticContent from '~/components/content/StaticContent.vue'
import { IMAGE_SIZES } from '#shared/design/tokens'
import ResponsiveImage from '~/components/media/ResponsiveImage.vue'

const props = defineProps<{
  locale: Locale
  title: string
  excerpt: string
  body: DocumentJson
  media: PublicMediaMap
  cover: PublicImage | null
  readingTimeMin: number
  /** ISO dates; the update shows only when it is a later day */
  publishedAt?: string | undefined
  updatedAt?: string | undefined
  topics?: BlogTopic[] | undefined
  /** false when the page enhances the content itself (see StaticContent) */
  enhance?: boolean | undefined
}>()

const formatDate = useFormatDate()
const showUpdate = computed(() => !!props.publishedAt && !!props.updatedAt && formatDate(props.updatedAt) !== formatDate(props.publishedAt))
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
      <p class="flex flex-wrap gap-x-3 text-step--1 text-text-muted">
        <span v-if="publishedAt">{{ $t('blog.published', { date: formatDate(publishedAt) }) }}</span>
        <span v-if="showUpdate">{{ $t('blog.updated', { date: formatDate(updatedAt!) }) }}</span>
        <span v-if="readingTimeMin > 0">{{ $t('content.readingTime', { minutes: readingTimeMin }) }}</span>
      </p>
      <TopicLinks
        v-if="topics?.length"
        :topics="topics"
        :label="$t('blog.articleTopics')"
      />
    </header>
    <ResponsiveImage
      v-if="cover"
      :image="cover"
      :sizes="IMAGE_SIZES.reading"
      priority
    />
    <slot name="toc" />
    <StaticContent
      :document="body"
      :media="media"
      :enhance="enhance ?? true"
    />
    <slot name="after" />
  </article>
</template>
