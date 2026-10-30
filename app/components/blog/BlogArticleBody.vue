<script setup lang="ts">
// Everything of an article page that is static (F06-T5): the article view, its table of contents and related
// articles. The page loads it with hydrate-never, so on a first visit none of this code is downloaded (it kept the
// article over its JS budget otherwise); the page runs the content enhancements on its own root
import type { BlogArticle } from '#shared/content/blog'
import ArticleToc from '~/components/blog/ArticleToc.vue'
import BlogCard from '~/components/blog/BlogCard.vue'
import ArticleView from '~/components/content/ArticleView.vue'

defineProps<{ article: BlogArticle }>()
const relatedId = useId()
</script>

<template>
  <ArticleView
    :locale="article.locale"
    :title="article.title"
    :excerpt="article.excerpt"
    :body="article.body"
    :media="article.media"
    :cover="article.cover"
    :reading-time-min="article.readingTimeMin"
    :published-at="article.firstPublishedAt"
    :updated-at="article.publishedAt"
    :topics="article.topics"
    :enhance="false"
  >
    <template #toc>
      <ArticleToc :body="article.body" />
    </template>
    <template #after>
      <section
        v-if="article.related.length > 0"
        class="grid gap-6"
        :aria-labelledby="relatedId"
      >
        <UiHeading
          :id="relatedId"
          :level="2"
          :size="3"
        >
          {{ $t('blog.related') }}
        </UiHeading>
        <BlogCard
          v-for="card in article.related"
          :key="card.slug"
          :card="card"
          :level="3"
        />
      </section>
    </template>
  </ArticleView>
</template>
