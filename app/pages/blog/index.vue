<script setup lang="ts">
// The blog (F06-T5, RF-01.4): the locale's published articles, newest first, 10 per page (?page=N, canonical keeps
// it from page 2), the topics with articles as links, and the RSS in the head. A page past the last is 404; an
// empty blog is noindex. Only published snapshots are read (/api/public)
import type { BlogList } from '#shared/content/blog'
import { parsePage, priorityCover } from '#shared/content/blog'
import BlogCard from '~/components/blog/BlogCard.vue'
import BlogPagination from '~/components/blog/BlogPagination.vue'
import TopicLinks from '~/components/blog/TopicLinks.vue'

definePageMeta({ key: route => route.fullPath })

const { locale, t } = useI18n()
const route = useRoute()
const page = parsePage(route.query.page)
if (page === null) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}
const data = await usePublicData<BlogList>(`blog:${locale.value}:${page}`, '/api/public/blog', { locale: locale.value, page })

usePageSeo({
  title: () => (page > 1 ? `${t('blog.title')} — ${t('blog.page', { page, pages: data.value.pages })}` : t('blog.title')),
  description: () => t('blog.intro'),
  page,
  noindex: () => data.value.total === 0,
})
useBlogFeed()
</script>

<template>
  <div class="grid gap-10">
    <header class="grid gap-4">
      <UiHeading :level="1">
        {{ $t('blog.title') }}
      </UiHeading>
      <p class="text-text-muted">
        {{ $t('blog.intro') }}
      </p>
      <TopicLinks
        :topics="data.topics"
        :label="$t('blog.topicsLabel')"
      />
    </header>
    <p v-if="data.items.length === 0">
      {{ $t('blog.empty') }}
    </p>
    <section
      v-else
      class="grid gap-8"
      :aria-label="$t('blog.title')"
    >
      <BlogCard
        v-for="(card, index) in data.items"
        :key="card.slug"
        :card="card"
        wide
        :priority="index === priorityCover(data.items)"
      />
    </section>
    <BlogPagination
      :page="data.page"
      :pages="data.pages"
    />
  </div>
</template>
