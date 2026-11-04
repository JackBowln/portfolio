<script setup lang="ts">
// A topic (F06-T5): its published articles in the locale, paginated like the blog. Exists only in a locale where
// the topic has a name and at least one article (topic names are translated with F09; until then, pt-BR only)
import type { BlogTopicPage } from '#shared/content/blog'
import type { Locale } from '#shared/types/enums'
import { parsePage, priorityCover } from '#shared/content/blog'
import BlogCard from '~/components/blog/BlogCard.vue'
import BlogPagination from '~/components/blog/BlogPagination.vue'

definePageMeta({
  key: route => route.fullPath,
  i18n: { paths: { 'pt-BR': '/blog/temas/[slug]', 'en': '/blog/topics/[slug]', 'es': '/blog/temas/[slug]', 'de': '/blog/themen/[slug]', 'fr': '/blog/sujets/[slug]' } },
})

const { locale, t } = useI18n()
const route = useRoute()
const slug = String(route.params.slug)
const page = parsePage(route.query.page)
if (page === null) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
}
const data = await usePublicData<BlogTopicPage>(`topic:${locale.value}:${slug}:${page}`, `/api/public/blog/topics/${encodeURIComponent(slug)}`, { locale: locale.value, page })

// Topic slugs are per locale; only the current one is known to exist, so the switcher sends the others to the blog
const setI18nParams = useSetI18nParams()
setI18nParams({ [locale.value]: { slug } })
useLocaleFallback([locale.value as Locale], '/blog')

usePageSeo({
  title: () => t('blog.topicTitle', { name: data.value.topic.name }),
  description: () => t('blog.topicIntro', { name: data.value.topic.name }),
  published: () => [locale.value as Locale],
  page,
})
// JSON-LD from the response (F11-T1)
useJsonLd(() => data.value.jsonLd)
useBlogFeed()
</script>

<template>
  <div class="grid gap-10">
    <header class="grid gap-4">
      <p>
        <NuxtLinkLocale
          to="/blog"
          class="inline-flex min-h-(--target-min) items-center underline underline-offset-(--underline-offset) hover:text-accent"
        >
          {{ $t('blog.back') }}
        </NuxtLinkLocale>
      </p>
      <UiHeading :level="1">
        {{ $t('blog.topicTitle', { name: data.topic.name }) }}
      </UiHeading>
      <p class="text-text-muted">
        {{ $t('blog.topicCount', { count: data.total }, data.total) }}
      </p>
    </header>
    <section
      class="grid gap-8"
      :aria-label="$t('blog.topicTitle', { name: data.topic.name })"
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
